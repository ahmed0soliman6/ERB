using System;
using System.Collections.Generic;
using System.Data;
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

    internal sealed class DraftDocument
    {
        public long Id { get; set; }
        public long WarehouseId { get; set; }
        public long SourceWarehouseId { get; set; }
        public long DestinationWarehouseId { get; set; }
        public string Notes { get; set; }
        public List<MovementLine> Lines { get; private set; } = new List<MovementLine>();
    }

    internal sealed class DocumentService
    {
        private readonly SQLiteConnection _connection;
        private readonly StockMovementService _movements;
        private readonly UserSession _session;
        public DocumentService(SQLiteConnection connection, UserSession session) { _connection = connection; _session = session; _movements = new StockMovementService(connection); }

        public DataTable ListDrafts(string kind, long userId)
        {
            var table = new DataTable();
            using (var c = _connection.CreateCommand()) using (var a = new SQLiteDataAdapter(c))
            {
                c.CommandText = "SELECT id, document_no || ' | ' || document_date AS display_name FROM " + HeaderTable(kind) + " WHERE status='DRAFT' AND created_by=@u ORDER BY id DESC;";
                c.Parameters.AddWithValue("@u", userId); a.Fill(table);
            }
            return table;
        }

        public long SaveDraft(string kind, long documentId, long warehouseId, long destinationWarehouseId, IList<MovementLine> lines, string notes, long userId)
        {
            EnsureWarehouse(warehouseId);
            if (kind == "TRANSFER") EnsureWarehouse(destinationWarehouseId);
            if (lines == null || lines.Count == 0) throw new InvalidOperationException("أضف صنفًا واحدًا على الأقل قبل حفظ المسودة.");
            using (var tx = _connection.BeginTransaction())
            {
                var table = HeaderTable(kind); var lineTable = LineTable(kind); var fk = ForeignKey(kind);
                if (documentId == 0) documentId = InsertHeader(kind, warehouseId, destinationWarehouseId, notes, userId, tx);
                else
                {
                    EnsureOwnedDraft(table, documentId, userId, tx);
                    UpdateHeader(kind, documentId, warehouseId, destinationWarehouseId, notes, tx);
                    DeleteLines(lineTable, fk, documentId, tx);
                }
                foreach (var line in lines) InsertLine(kind, documentId, line, tx);
                tx.Commit(); return documentId;
            }
        }

        public DraftDocument LoadDraft(string kind, long documentId, long userId)
        {
            var draft = new DraftDocument { Id = documentId };
            using (var c = _connection.CreateCommand())
            {
                c.CommandText = HeaderSelect(kind) + " WHERE id=@id AND status='DRAFT' AND created_by=@u;";
                c.Parameters.AddWithValue("@id", documentId); c.Parameters.AddWithValue("@u", userId);
                using (var r = c.ExecuteReader())
                {
                    if (!r.Read()) throw new InvalidOperationException("المسودة غير موجودة أو لا تملك صلاحية فتحها.");
                    if (kind == "TRANSFER") { draft.SourceWarehouseId = Convert.ToInt64(r[0]); draft.DestinationWarehouseId = Convert.ToInt64(r[1]); }
                    else draft.WarehouseId = Convert.ToInt64(r[0]);
                    EnsureWarehouse(draft.WarehouseId == 0 ? draft.SourceWarehouseId : draft.WarehouseId);
                    if (kind == "TRANSFER") EnsureWarehouse(draft.DestinationWarehouseId);
                    draft.Notes = r[2] == DBNull.Value ? "" : Convert.ToString(r[2]);
                }
            }
            using (var c = _connection.CreateCommand())
            {
                c.CommandText = "SELECT l.item_id,i.name_ar,l.unit_id,u.name_ar,l.quantity,l.notes FROM " + LineTable(kind) + " l JOIN items i ON i.id=l.item_id JOIN units u ON u.id=l.unit_id WHERE l." + ForeignKey(kind) + "=@id ORDER BY l.id;";
                c.Parameters.AddWithValue("@id", documentId);
                using (var r = c.ExecuteReader()) while (r.Read()) draft.Lines.Add(new MovementLine { ItemId = Convert.ToInt64(r[0]), ItemName = Convert.ToString(r[1]), UnitId = Convert.ToInt64(r[2]), UnitName = Convert.ToString(r[3]), Quantity = Convert.ToDecimal(r[4]), Notes = r[5] == DBNull.Value ? "" : Convert.ToString(r[5]) });
            }
            return draft;
        }

        public void ApproveDraft(string kind, long documentId, long userId)
        {
            using (var tx = _connection.BeginTransaction())
            {
                var table = HeaderTable(kind); EnsureOwnedDraft(table, documentId, userId, tx);
                var draft = LoadDraftWithinTransaction(kind, documentId, tx);
                EnsureWarehouse(draft.WarehouseId == 0 ? draft.SourceWarehouseId : draft.WarehouseId);
                if (kind == "TRANSFER") EnsureWarehouse(draft.DestinationWarehouseId);
                if (draft.Lines.Count == 0) throw new InvalidOperationException("لا يمكن اعتماد مسودة بلا أصناف.");
                foreach (var line in draft.Lines)
                {
                    if (kind == "RECEIPT") _movements.AddMovement(NewNo("REC-M"), "RECEIPT", line.ItemId, draft.WarehouseId, line.Quantity, true, line.UnitId, table, documentId, userId, DateTime.UtcNow, line.Notes, tx);
                    else if (kind == "TRANSFER") _movements.AddAtomicTransfer(NewNo("TRF-OUT"), NewNo("TRF-IN"), line.ItemId, draft.SourceWarehouseId, draft.DestinationWarehouseId, line.Quantity, line.UnitId, table, documentId, userId, DateTime.UtcNow, line.Notes, tx);
                    else _movements.AddMovement(NewNo(kind == "ISSUE" ? "ISS-M" : "CON-M"), kind, line.ItemId, draft.WarehouseId, line.Quantity, false, line.UnitId, table, documentId, userId, DateTime.UtcNow, line.Notes, tx);
                }
                using (var c = _connection.CreateCommand()) { c.Transaction = tx; c.CommandText = "UPDATE " + table + " SET status='APPROVED', approved_by=@u, approved_at=CURRENT_TIMESTAMP WHERE id=@id AND status='DRAFT';"; c.Parameters.AddWithValue("@u", userId); c.Parameters.AddWithValue("@id", documentId); if (c.ExecuteNonQuery() != 1) throw new InvalidOperationException("تعذر اعتماد المسودة."); }
                tx.Commit();
            }
        }

        private DraftDocument LoadDraftWithinTransaction(string kind, long id, SQLiteTransaction tx)
        {
            var d = new DraftDocument { Id = id };
            using (var c = _connection.CreateCommand()) { c.Transaction = tx; c.CommandText = HeaderSelect(kind) + " WHERE id=@id AND status='DRAFT';"; c.Parameters.AddWithValue("@id", id); using (var r = c.ExecuteReader()) { if (!r.Read()) throw new InvalidOperationException("المسودة غير موجودة."); if (kind == "TRANSFER") { d.SourceWarehouseId = Convert.ToInt64(r[0]); d.DestinationWarehouseId = Convert.ToInt64(r[1]); } else d.WarehouseId = Convert.ToInt64(r[0]); d.Notes = r[2] == DBNull.Value ? "" : Convert.ToString(r[2]); } }
            using (var c = _connection.CreateCommand()) { c.Transaction = tx; c.CommandText = "SELECT l.item_id,i.name_ar,l.unit_id,u.name_ar,l.quantity,l.notes FROM " + LineTable(kind) + " l JOIN items i ON i.id=l.item_id JOIN units u ON u.id=l.unit_id WHERE l." + ForeignKey(kind) + "=@id ORDER BY l.id;"; c.Parameters.AddWithValue("@id", id); using (var r = c.ExecuteReader()) while (r.Read()) d.Lines.Add(new MovementLine { ItemId = Convert.ToInt64(r[0]), ItemName = Convert.ToString(r[1]), UnitId = Convert.ToInt64(r[2]), UnitName = Convert.ToString(r[3]), Quantity = Convert.ToDecimal(r[4]), Notes = r[5] == DBNull.Value ? "" : Convert.ToString(r[5]) }); }
            return d;
        }

        private long InsertHeader(string kind, long warehouseId, long destinationId, string notes, long userId, SQLiteTransaction tx)
        {
            string table = HeaderTable(kind), no = NewNo(kind); string sql;
            if (kind == "RECEIPT") sql = "INSERT INTO receipts(document_no,document_date,destination_warehouse_id,receipt_type,status,created_by,notes) VALUES(@no,@date,@warehouse,'RECEIPT','DRAFT',@u,@notes); SELECT last_insert_rowid();";
            else if (kind == "TRANSFER") sql = "INSERT INTO transfers(document_no,document_date,source_warehouse_id,destination_warehouse_id,status,created_by,notes) VALUES(@no,@date,@warehouse,@destination,'DRAFT',@u,@notes); SELECT last_insert_rowid();";
            else sql = "INSERT INTO " + table + "(document_no,document_date,warehouse_id,status,created_by,notes) VALUES(@no,@date,@warehouse,'DRAFT',@u,@notes); SELECT last_insert_rowid();";
            using (var c = _connection.CreateCommand()) { c.Transaction = tx; c.CommandText = sql; c.Parameters.AddWithValue("@no", no); c.Parameters.AddWithValue("@date", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture)); c.Parameters.AddWithValue("@warehouse", warehouseId); c.Parameters.AddWithValue("@destination", destinationId); c.Parameters.AddWithValue("@u", userId); c.Parameters.AddWithValue("@notes", (object)notes ?? DBNull.Value); return Convert.ToInt64(c.ExecuteScalar()); }
        }
        private void UpdateHeader(string kind, long id, long warehouseId, long destinationId, string notes, SQLiteTransaction tx) { using (var c = _connection.CreateCommand()) { c.Transaction = tx; c.CommandText = kind == "TRANSFER" ? "UPDATE transfers SET source_warehouse_id=@w,destination_warehouse_id=@d,notes=@n,updated_at=CURRENT_TIMESTAMP WHERE id=@id;" : "UPDATE " + HeaderTable(kind) + " SET " + (kind == "RECEIPT" ? "destination_warehouse_id" : "warehouse_id") + "=@w,notes=@n,updated_at=CURRENT_TIMESTAMP WHERE id=@id;"; c.Parameters.AddWithValue("@w", warehouseId); c.Parameters.AddWithValue("@d", destinationId); c.Parameters.AddWithValue("@n", (object)notes ?? DBNull.Value); c.Parameters.AddWithValue("@id", id); c.ExecuteNonQuery(); } }
        private void EnsureOwnedDraft(string table, long id, long userId, SQLiteTransaction tx) { using (var c = _connection.CreateCommand()) { c.Transaction = tx; c.CommandText = "SELECT COUNT(*) FROM " + table + " WHERE id=@id AND status='DRAFT' AND created_by=@u;"; c.Parameters.AddWithValue("@id", id); c.Parameters.AddWithValue("@u", userId); if (Convert.ToInt32(c.ExecuteScalar()) != 1) throw new InvalidOperationException("المسودة غير موجودة أو لا تملك صلاحية تعديلها."); } }
        private void DeleteLines(string table, string fk, long id, SQLiteTransaction tx) { using (var c = _connection.CreateCommand()) { c.Transaction = tx; c.CommandText = "DELETE FROM " + table + " WHERE " + fk + "=@id;"; c.Parameters.AddWithValue("@id", id); c.ExecuteNonQuery(); } }
        private void InsertLine(string kind, long id, MovementLine line, SQLiteTransaction tx) { string table = LineTable(kind), fk = ForeignKey(kind), extra = kind == "RECEIPT" ? ",unit_cost,batch_no,expiry_date" : "", values = kind == "RECEIPT" ? ",NULL,NULL,NULL" : ""; using (var c = _connection.CreateCommand()) { c.Transaction = tx; c.CommandText = "INSERT INTO " + table + "(" + fk + ",item_id,quantity,unit_id,notes" + extra + ") VALUES(@id,@item,@q,@unit,@notes" + values + ");"; c.Parameters.AddWithValue("@id", id); c.Parameters.AddWithValue("@item", line.ItemId); c.Parameters.AddWithValue("@q", line.Quantity); c.Parameters.AddWithValue("@unit", line.UnitId); c.Parameters.AddWithValue("@notes", (object)line.Notes ?? DBNull.Value); c.ExecuteNonQuery(); } }
        private static string HeaderTable(string kind) { return kind == "RECEIPT" ? "receipts" : kind == "TRANSFER" ? "transfers" : kind == "ISSUE" ? "issues" : "consumptions"; }
        private void EnsureWarehouse(long warehouseId) { if (!_session.CanWarehouse(warehouseId)) throw new InvalidOperationException("لا تملك صلاحية استخدام هذا المخزن."); }
        private static string LineTable(string kind) { return kind == "RECEIPT" ? "receipt_lines" : kind == "TRANSFER" ? "transfer_lines" : kind == "ISSUE" ? "issue_lines" : "consumption_lines"; }
        private static string ForeignKey(string kind) { return kind == "RECEIPT" ? "receipt_id" : kind == "TRANSFER" ? "transfer_id" : kind == "ISSUE" ? "issue_id" : "consumption_id"; }
        private static string HeaderSelect(string kind) { return kind == "TRANSFER" ? "SELECT source_warehouse_id,destination_warehouse_id,notes FROM transfers" : "SELECT " + (kind == "RECEIPT" ? "destination_warehouse_id" : "warehouse_id") + ",0,notes FROM " + HeaderTable(kind); }
        private static string NewNo(string prefix) { return prefix + "-" + DateTime.Now.ToString("yyyyMMddHHmmssfff", CultureInfo.InvariantCulture) + "-" + Guid.NewGuid().ToString("N").Substring(0, 5).ToUpperInvariant(); }
    }
}
