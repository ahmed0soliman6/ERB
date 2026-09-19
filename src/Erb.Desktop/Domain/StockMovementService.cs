using System;
using System.Data.SQLite;

namespace Erb.Desktop.Domain
{
    internal sealed class StockMovementService
    {
        private readonly SQLiteConnection _connection;

        public StockMovementService(SQLiteConnection connection)
        {
            _connection = connection;
        }

        public decimal GetBalance(long itemId, long warehouseId, SQLiteTransaction transaction = null)
        {
            using (var command = _connection.CreateCommand())
            {
                command.Transaction = transaction;
                command.CommandText = @"SELECT COALESCE(SUM(signed_quantity), 0)
                                        FROM stock_movements
                                        WHERE item_id = @item_id AND warehouse_id = @warehouse_id;";
                command.Parameters.AddWithValue("@item_id", itemId);
                command.Parameters.AddWithValue("@warehouse_id", warehouseId);
                return Convert.ToDecimal(command.ExecuteScalar());
            }
        }

        public long AddMovement(string movementNo, string movementType, long itemId, long warehouseId,
            decimal quantity, bool isInbound, long unitId, string sourceType, long sourceId,
            long userId, DateTime occurredAt, string notes, SQLiteTransaction transaction)
        {
            if (quantity <= 0) throw new ArgumentOutOfRangeException("quantity");
            if (transaction == null) throw new ArgumentNullException("transaction");
            if (!isInbound && GetBalance(itemId, warehouseId, transaction) < quantity)
                throw new InvalidOperationException("لا يمكن اعتماد الحركة لأن الرصيد المتاح غير كافٍ.");

            using (var command = _connection.CreateCommand())
            {
                command.Transaction = transaction;
                command.CommandText = @"INSERT INTO stock_movements
                    (movement_no, movement_type, item_id, warehouse_id, quantity, direction,
                     signed_quantity, unit_id, source_document_type, source_document_id,
                     user_id, occurred_at, notes)
                    VALUES (@movement_no, @movement_type, @item_id, @warehouse_id, @quantity,
                            @direction, @signed_quantity, @unit_id, @source_type, @source_id,
                            @user_id, @occurred_at, @notes);
                    SELECT last_insert_rowid();";
                command.Parameters.AddWithValue("@movement_no", movementNo);
                command.Parameters.AddWithValue("@movement_type", movementType);
                command.Parameters.AddWithValue("@item_id", itemId);
                command.Parameters.AddWithValue("@warehouse_id", warehouseId);
                command.Parameters.AddWithValue("@quantity", quantity);
                command.Parameters.AddWithValue("@direction", isInbound ? "IN" : "OUT");
                command.Parameters.AddWithValue("@signed_quantity", isInbound ? quantity : -quantity);
                command.Parameters.AddWithValue("@unit_id", unitId);
                command.Parameters.AddWithValue("@source_type", sourceType);
                command.Parameters.AddWithValue("@source_id", sourceId);
                command.Parameters.AddWithValue("@user_id", userId);
                command.Parameters.AddWithValue("@occurred_at", occurredAt.ToUniversalTime().ToString("o"));
                command.Parameters.AddWithValue("@notes", (object)notes ?? DBNull.Value);
                return Convert.ToInt64(command.ExecuteScalar());
            }
        }

        public void AddAtomicTransfer(string movementNoOut, string movementNoIn, long itemId,
            long sourceWarehouseId, long destinationWarehouseId, decimal quantity, long unitId,
            string sourceType, long sourceId, long userId, DateTime occurredAt, string notes,
            SQLiteTransaction transaction)
        {
            if (sourceWarehouseId == destinationWarehouseId)
                throw new InvalidOperationException("لا يمكن التحويل إلى المخزن نفسه.");
            AddMovement(movementNoOut, "TRANSFER", itemId, sourceWarehouseId, quantity, false,
                unitId, sourceType, sourceId, userId, occurredAt, notes, transaction);
            AddMovement(movementNoIn, "TRANSFER", itemId, destinationWarehouseId, quantity, true,
                unitId, sourceType, sourceId, userId, occurredAt, notes, transaction);
        }
    }
}
