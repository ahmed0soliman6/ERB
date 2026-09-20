using System;
using System.Data;
using System.Data.SQLite;
using System.Drawing;
using System.Windows.Forms;
using Erb.Desktop.Domain;

namespace Erb.Desktop
{
    internal sealed class ReportsForm : Form
    {
        private readonly SQLiteConnection _connection;
        private readonly UserSession _session;
        private readonly DateTimePicker _from = new DateTimePicker { Format = DateTimePickerFormat.Short };
        private readonly DateTimePicker _to = new DateTimePicker { Format = DateTimePickerFormat.Short };
        private readonly ComboBox _warehouse = new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList };
        private readonly Label _kpi = new Label();
        private readonly DataGridView _grid = new DataGridView();
        private readonly TabControl _tabs = new TabControl { Dock = DockStyle.Fill };
        public ReportsForm(SQLiteConnection connection, UserSession session)
        {
            _connection = connection; _session = session; Text = "لوحات تحليلية وتقارير حركة المخزون"; Width = 1120; Height = 700; StartPosition = FormStartPosition.CenterParent; RightToLeft = RightToLeft.Yes; RightToLeftLayout = true; Font = new Font("Tahoma", 10F);
            _from.Value = DateTime.Today.AddDays(-30); _to.Value = DateTime.Today;
            var top = new Panel { Dock = DockStyle.Top, Height = 95, Padding = new Padding(12) };
            top.Controls.Add(new Label { Text = "من", AutoSize = true, Left = 12, Top = 18 }); _from.SetBounds(48, 12, 120, 28); top.Controls.Add(_from);
            top.Controls.Add(new Label { Text = "إلى", AutoSize = true, Left = 180, Top = 18 }); _to.SetBounds(215, 12, 120, 28); top.Controls.Add(_to);
            top.Controls.Add(new Label { Text = "المخزن", AutoSize = true, Left = 350, Top = 18 }); _warehouse.SetBounds(405, 12, 230, 28); top.Controls.Add(_warehouse);
            var refresh = new Button { Text = "تحديث التقارير", Left = 650, Top = 12, Width = 130 }; refresh.Click += delegate { LoadReports(); }; top.Controls.Add(refresh);
            _kpi.SetBounds(12, 52, 900, 28); _kpi.Font = new Font("Tahoma", 11F, FontStyle.Bold); top.Controls.Add(_kpi);
            var movement = new TabPage("ملخص الحركات"); movement.Controls.Add(_grid); _tabs.TabPages.Add(movement); var topItems = new TabPage("الأصناف الأعلى صرفًا"); topItems.Controls.Add(BuildSecondaryGrid()); _tabs.TabPages.Add(topItems); var low = new TabPage("الأرصدة تحت الحد الأدنى"); low.Controls.Add(BuildSecondaryGrid()); _tabs.TabPages.Add(low);
            Controls.Add(_tabs); Controls.Add(top); Load += delegate { LoadWarehouses(); LoadReports(); };
        }
        private DataGridView BuildSecondaryGrid() { var g = new DataGridView { Dock = DockStyle.Fill, ReadOnly = true, AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill, AllowUserToAddRows = false }; return g; }
        private void LoadWarehouses()
        {
            var table = new DataTable(); using (var c = _connection.CreateCommand()) using (var a = new SQLiteDataAdapter(c)) { c.CommandText = _session.IsAdmin ? "SELECT 0 AS id,'كل المخازن' AS name UNION ALL SELECT id,name FROM warehouses WHERE is_active=1 ORDER BY id;" : "SELECT 0 AS id,'كل المخازن' AS name UNION ALL SELECT w.id,w.name FROM warehouses w JOIN user_warehouses uw ON uw.warehouse_id=w.id WHERE uw.user_id=" + _session.UserId + " AND w.is_active=1 ORDER BY id;"; a.Fill(table); }
            _warehouse.DataSource = table; _warehouse.DisplayMember = "name"; _warehouse.ValueMember = "id"; if (table.Rows.Count > 0) _warehouse.SelectedIndex = 0;
        }
        private string Scope(string alias)
        {
            var id = Convert.ToInt64(_warehouse.SelectedValue); var sql = ""; if (id != 0) sql += " AND " + alias + ".warehouse_id=" + id; if (!_session.IsAdmin) sql += " AND EXISTS (SELECT 1 FROM user_warehouses uw WHERE uw.user_id=" + _session.UserId + " AND uw.warehouse_id=" + alias + ".warehouse_id)"; return sql;
        }
        private void LoadReports()
        {
            if (_warehouse.SelectedIndex < 0) return; var start = _from.Value.Date.ToString("yyyy-MM-dd 00:00:00"); var end = _to.Value.Date.AddDays(1).ToString("yyyy-MM-dd 00:00:00");
            using (var c = _connection.CreateCommand()) using (var a = new SQLiteDataAdapter(c)) { c.CommandText = "SELECT movement_type AS [نوع الحركة],direction AS [الاتجاه],COUNT(*) AS [عدد الحركات],ROUND(SUM(quantity),2) AS [إجمالي الكمية] FROM stock_movements WHERE occurred_at>=@from AND occurred_at<@to" + Scope("stock_movements") + " GROUP BY movement_type,direction ORDER BY movement_type,direction;"; c.Parameters.AddWithValue("@from", start); c.Parameters.AddWithValue("@to", end); var table = new DataTable(); a.Fill(table); _grid.DataSource = table; var total = 0m; foreach (DataRow r in table.Rows) total += Convert.ToDecimal(r["إجمالي الكمية"]); _kpi.Text = "الفترة: " + _from.Value.ToShortDateString() + " — " + _to.Value.ToShortDateString() + " | إجمالي الكميات: " + total.ToString("N2") + " | الصفوف: " + table.Rows.Count; }
            var pages = _tabs.TabPages; LoadTopItems((DataGridView)pages[1].Controls[0], start, end); LoadLowStock((DataGridView)pages[2].Controls[0]);
        }
        private void LoadTopItems(DataGridView grid, string start, string end) { using (var c = _connection.CreateCommand()) using (var a = new SQLiteDataAdapter(c)) { c.CommandText = "SELECT i.sku AS [SKU],i.name_ar AS [الصنف],u.name_ar AS [الوحدة],ROUND(SUM(sm.quantity),2) AS [إجمالي الصرف] FROM stock_movements sm JOIN items i ON i.id=sm.item_id JOIN units u ON u.id=sm.unit_id WHERE sm.direction='OUT' AND sm.occurred_at>=@from AND sm.occurred_at<@to" + Scope("sm") + " GROUP BY i.id,u.id ORDER BY SUM(sm.quantity) DESC LIMIT 20;"; c.Parameters.AddWithValue("@from", start); c.Parameters.AddWithValue("@to", end); var t = new DataTable(); a.Fill(t); grid.DataSource = t; } }
        private void LoadLowStock(DataGridView grid) { using (var c = _connection.CreateCommand()) using (var a = new SQLiteDataAdapter(c)) { c.CommandText = "SELECT w.name AS [المخزن],i.sku AS [SKU],i.name_ar AS [الصنف],ROUND(COALESCE(SUM(sm.signed_quantity),0),2) AS [الرصيد],i.minimum_stock AS [الحد الأدنى] FROM warehouses w CROSS JOIN items i LEFT JOIN stock_movements sm ON sm.warehouse_id=w.id AND sm.item_id=i.id WHERE w.is_active=1 AND i.is_active=1" + (_session.IsAdmin ? "" : " AND EXISTS (SELECT 1 FROM user_warehouses uw WHERE uw.user_id=" + _session.UserId + " AND uw.warehouse_id=w.id)") + " GROUP BY w.id,i.id HAVING COALESCE(SUM(sm.signed_quantity),0) < i.minimum_stock ORDER BY w.name,i.name_ar;"; var t = new DataTable(); a.Fill(t); grid.DataSource = t; } }
    }
}
