using System;
using System.Data;
using System.Data.SQLite;

namespace Erb.Desktop.Domain
{
    internal sealed class AlertService
    {
        private readonly SQLiteConnection _connection;
        private readonly UserSession _session;
        public AlertService(SQLiteConnection connection, UserSession session) { _connection = connection; _session = session; }
        public DataTable ListAlerts()
        {
            var table = new DataTable();
            using (var c = _connection.CreateCommand()) using (var a = new SQLiteDataAdapter(c))
            {
                c.CommandText = @"WITH balances AS (
                    SELECT w.id AS warehouse_id,w.name AS warehouse_name,i.id AS item_id,i.sku,i.name_ar,
                           u.name_ar AS unit_name,i.minimum_stock,i.reorder_point,
                           COALESCE(iws.minimum_stock_override,i.minimum_stock) AS effective_minimum,
                           COALESCE(SUM(sm.signed_quantity),0) AS balance
                    FROM warehouses w CROSS JOIN items i JOIN units u ON u.id=i.base_unit_id
                    LEFT JOIN item_warehouse_settings iws ON iws.item_id=i.id AND iws.warehouse_id=w.id
                    LEFT JOIN stock_movements sm ON sm.warehouse_id=w.id AND sm.item_id=i.id
                    WHERE w.is_active=1 AND i.is_active=1 " + (_session.IsAdmin ? "" : "AND EXISTS (SELECT 1 FROM user_warehouses uw WHERE uw.user_id=" + _session.UserId + " AND uw.warehouse_id=w.id) ") + @"
                    GROUP BY w.id,i.id,u.id,iws.minimum_stock_override
                ) SELECT warehouse_name AS [المخزن],sku AS [SKU],name_ar AS [الصنف],unit_name AS [الوحدة],
                    ROUND(balance,2) AS [الرصيد],ROUND(reorder_point,2) AS [حد الطلب],ROUND(effective_minimum,2) AS [الحد الأدنى],
                    CASE WHEN balance <= effective_minimum THEN 'حرج — الحد الأدنى' ELSE 'تنبيه — حد الطلب' END AS [التنبيه]
                    FROM balances WHERE balance <= reorder_point ORDER BY CASE WHEN balance <= effective_minimum THEN 0 ELSE 1 END,warehouse_name,name_ar;";
                a.Fill(table);
            }
            return table;
        }
        public int Count() { return ListAlerts().Rows.Count; }
    }
}
