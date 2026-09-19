using System;
using System.Collections.Generic;
using System.Data.SQLite;
using System.Globalization;

namespace Erb.Desktop.Domain
{
    internal sealed class MovementLine
    {
        public long ItemId { get; set; }
        public string ItemName { get; set; }
        public long UnitId { get; set; }
        public string UnitName { get; set; }
        public decimal Quantity { get; set; }
        public string Notes { get; set; }
    }

    internal sealed class DocumentService
    {
        private readonly SQLiteConnection _connection;
        private readonly StockMovementService _movements;
        private const long SystemUserId = 1;

        public DocumentService(SQLiteConnection connection)
        {
            _connection = connection;
            _movements = new StockMovementService(connection);
            EnsureSystemUser();
        }

        public long CreateApprovedReceipt(long warehouseId, IList<MovementLine> lines, string notes)
        {
            if (lines == null || lines.Count == 0) throw new InvalidOperationException("أضف صنفًا واحدًا على الأقل.");
            using (var tx = _connection.BeginTransaction())
            {
                var documentId = InsertHeader("receipts", "REC", warehouseId, 0, notes, tx);
                foreach (var line in lines)
                {
                    InsertLine("receipt_lines", "receipt_id", documentId, line, tx, true);
                    _movements.AddMovement(NewNo("REC-M"), "RECEIPT", line.ItemId, warehouseId,
                        line.Quantity, true, line.UnitId, "receipts", documentId, SystemUserId, DateTime.UtcNow, line.Notes, tx);
                }
                Approve("receipts", documentId, tx);
                tx.Commit();
                return documentId;
            }
        }

        public long CreateApprovedTransfer(long sourceWarehouseId, long destinationWarehouseId, IList<MovementLine> lines, string notes)
        {
            if (sourceWarehouseId == destinationWarehouseId) throw new InvalidOperationException("اختر مخزنين مختلفين للتحويل.");
            if (lines == null || lines.Count == 0) throw new InvalidOperationException("أضف صنفًا واحدًا على الأقل.");
            using (var tx = _connection.BeginTransaction())
            {
                var documentId = InsertHeader("transfers", "TRF", sourceWarehouseId, destinationWarehouseId, notes, tx);
                foreach (var line in lines)
                {
                    InsertLine("transfer_lines", "transfer_id", documentId, line, tx, false);
                    _movements.AddAtomicTransfer(NewNo("TRF-OUT"), NewNo("TRF-IN"), line.ItemId,
                        sourceWarehouseId, destinationWarehouseId, line.Quantity, line.UnitId,
                        "transfers", documentId, SystemUserId, DateTime.UtcNow, line.Notes, tx);
                }
                Approve("transfers", documentId, tx);
                tx.Commit();
                return documentId;
            }
        }

        public long CreateApprovedIssue(long warehouseId, IList<MovementLine> lines, string notes)
        {
            return CreateOutbound("issues", "issue_lines", "issue_id", "ISS", warehouseId, lines, notes, "ISSUE");
        }

        public long CreateApprovedConsumption(long warehouseId, IList<MovementLine> lines, string notes)
        {
            return CreateOutbound("consumptions", "consumption_lines", "consumption_id", "CON", warehouseId, lines, notes, "CONSUMPTION");
        }

        private long CreateOutbound(string headerTable, string lineTable, string foreignKey, string prefix,
            long warehouseId, IList<MovementLine> lines, string notes, string movementType)
        {
            if (lines == null || lines.Count == 0) throw new InvalidOperationException("أضف صنفًا واحدًا على الأقل.");
            using (var tx = _connection.BeginTransaction())
            {
                var documentId = InsertHeader(headerTable, prefix, warehouseId, 0, notes, tx);
                foreach (var line in lines)
                {
                    InsertLine(lineTable, foreignKey, documentId, line, tx, false);
                    _movements.AddMovement(NewNo(prefix + "-M"), movementType, line.ItemId, warehouseId,
                        line.Quantity, false, line.UnitId, headerTable, documentId, SystemUserId,
                        DateTime.UtcNow, line.Notes, tx);
                }
                Approve(headerTable, documentId, tx);
                tx.Commit();
                return documentId;
            }
        }

        private long InsertHeader(string table, string prefix, long firstWarehouseId, long secondWarehouseId, string notes, SQLiteTransaction tx)
        {
            string sql;
            if (table == "receipts")
                sql = "INSERT INTO receipts(document_no,document_date,destination_warehouse_id,receipt_type,status,created_by,notes) VALUES(@no,@date,@warehouse,'RECEIPT','DRAFT',@user,@notes); SELECT last_insert_rowid();";
            else if (table == "transfers")
                sql = "INSERT INTO transfers(document_no,document_date,source_warehouse_id,destination_warehouse_id,status,created_by,notes) VALUES(@no,@date,@source,@destination,'DRAFT',@user,@notes); SELECT last_insert_rowid();";
            else
                sql = "INSERT INTO " + table + "(document_no,document_date,warehouse_id,status,created_by,notes) VALUES(@no,@date,@warehouse,'DRAFT',@user,@notes); SELECT last_insert_rowid();";

            using (var command = _connection.CreateCommand())
            {
                command.Transaction = tx;
                command.CommandText = sql;
                command.Parameters.AddWithValue("@no", NewNo(prefix));
                command.Parameters.AddWithValue("@date", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture));
                command.Parameters.AddWithValue("@warehouse", firstWarehouseId);
                command.Parameters.AddWithValue("@source", firstWarehouseId);
                command.Parameters.AddWithValue("@destination", secondWarehouseId);
                command.Parameters.AddWithValue("@user", SystemUserId);
                command.Parameters.AddWithValue("@notes", (object)notes ?? DBNull.Value);
                return Convert.ToInt64(command.ExecuteScalar());
            }
        }

        private void InsertLine(string table, string foreignKey, long documentId, MovementLine line, SQLiteTransaction tx, bool receipt)
        {
            string extra = receipt ? ",unit_cost,batch_no,expiry_date" : "";
            string values = receipt ? ",NULL,NULL,NULL" : "";
            using (var command = _connection.CreateCommand())
            {
                command.Transaction = tx;
                command.CommandText = "INSERT INTO " + table + "(" + foreignKey + ",item_id,quantity,unit_id,notes" + extra + ") VALUES(@document,@item,@quantity,@unit,@notes" + values + ");";
                command.Parameters.AddWithValue("@document", documentId);
                command.Parameters.AddWithValue("@item", line.ItemId);
                command.Parameters.AddWithValue("@quantity", line.Quantity);
                command.Parameters.AddWithValue("@unit", line.UnitId);
                command.Parameters.AddWithValue("@notes", (object)line.Notes ?? DBNull.Value);
                command.ExecuteNonQuery();
            }
        }

        private void Approve(string table, long id, SQLiteTransaction tx)
        {
            using (var command = _connection.CreateCommand())
            {
                command.Transaction = tx;
                command.CommandText = "UPDATE " + table + " SET status='APPROVED', approved_by=@user, approved_at=CURRENT_TIMESTAMP WHERE id=@id AND status='DRAFT';";
                command.Parameters.AddWithValue("@user", SystemUserId);
                command.Parameters.AddWithValue("@id", id);
                if (command.ExecuteNonQuery() != 1) throw new InvalidOperationException("تعذر اعتماد المستند.");
            }
        }

        private void EnsureSystemUser()
        {
            using (var command = _connection.CreateCommand())
            {
                command.CommandText = "INSERT OR IGNORE INTO users(id,username,display_name,password_hash,password_salt) VALUES(1,'system','المستخدم المحلي',X'01',X'01');";
                command.ExecuteNonQuery();
            }
        }

        private static string NewNo(string prefix)
        {
            return prefix + "-" + DateTime.Now.ToString("yyyyMMddHHmmssfff", CultureInfo.InvariantCulture) + "-" + Guid.NewGuid().ToString("N").Substring(0, 5).ToUpperInvariant();
        }
    }
}
