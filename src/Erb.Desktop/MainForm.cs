using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SQLite;
using System.Drawing;
using System.Windows.Forms;
using Erb.Desktop.Domain;
using Erb.Desktop.Infrastructure;

namespace Erb.Desktop
{
    internal sealed class MainForm : Form
    {
        private readonly Database _database;
        private readonly DocumentService _documents;
        private readonly DataGridView _balanceGrid;
        private readonly Label _status;
        private readonly DataTable _items;
        private readonly DataTable _warehouses;
        private readonly Dictionary<TabPage, MovementTabState> _tabs = new Dictionary<TabPage, MovementTabState>();

        private sealed class MovementTabState
        {
            public string Kind;
            public TabPage Page;
            public ComboBox Warehouse;
            public ComboBox SourceWarehouse;
            public ComboBox DestinationWarehouse;
            public ComboBox Item;
            public NumericUpDown Quantity;
            public TextBox Notes;
            public DataGridView Lines;
        }

        public MainForm()
        {
            Text = "ERB — إدارة مخازن المجمع الطبي";
            Width = 1220;
            Height = 760;
            StartPosition = FormStartPosition.CenterScreen;
            RightToLeft = RightToLeft.Yes;
            RightToLeftLayout = true;
            Font = new Font("Tahoma", 10F);

            _database = new Database();
            _documents = new DocumentService(_database.Connection);
            _items = LoadTable("SELECT i.id AS item_id, i.name_ar, i.base_unit_id AS unit_id, u.name_ar AS unit_name FROM items i JOIN units u ON u.id=i.base_unit_id WHERE i.is_active=1 ORDER BY i.name_ar;");
            _warehouses = LoadTable("SELECT id, name FROM warehouses WHERE is_active=1 ORDER BY name;");
            _balanceGrid = BuildGrid();
            _status = new Label { Dock = DockStyle.Bottom, Height = 32, TextAlign = ContentAlignment.MiddleRight };

            var header = new Panel { Dock = DockStyle.Top, Height = 78, BackColor = Color.FromArgb(33, 55, 82) };
            var title = new Label
            {
                Text = "إدارة المخزون — Offline",
                ForeColor = Color.White,
                Font = new Font("Tahoma", 18F, FontStyle.Bold),
                Dock = DockStyle.Top,
                Height = 46,
                Padding = new Padding(20, 8, 10, 0)
            };
            var refresh = new Button { Text = "تحديث الأرصدة", Width = 130, Height = 28, Top = 45, Left = 20 };
            refresh.Click += delegate { LoadBalances(); };
            header.Controls.Add(refresh);
            header.Controls.Add(title);

            var tabs = new TabControl { Dock = DockStyle.Fill };
            var balancePage = new TabPage("الأرصدة الحالية");
            balancePage.Controls.Add(_balanceGrid);
            tabs.TabPages.Add(balancePage);
            AddMovementTab(tabs, "RECEIPT", "التوريد");
            AddMovementTab(tabs, "TRANSFER", "التحويل بين المخازن");
            AddMovementTab(tabs, "ISSUE", "الصرف");
            AddMovementTab(tabs, "CONSUMPTION", "الاستهلاك");
            tabs.SelectedIndexChanged += delegate { LoadBalances(); };

            Controls.Add(tabs);
            Controls.Add(_status);
            Controls.Add(header);
            Load += delegate { LoadBalances(); };
        }

        private void AddMovementTab(TabControl tabs, string kind, string title)
        {
            var page = new TabPage(title);
            var state = new MovementTabState { Kind = kind, Page = page, Lines = BuildLinesGrid() };
            var top = new Panel { Dock = DockStyle.Top, Height = 152, Padding = new Padding(12) };
            var warehouseLabel = new Label { Text = kind == "TRANSFER" ? "المخزن المصدر" : "المخزن", AutoSize = true, Top = 16, Left = 14 };
            if (kind == "TRANSFER")
            {
                state.SourceWarehouse = BuildCombo(_warehouses, "name", "id");
                state.SourceWarehouse.Left = 122; state.SourceWarehouse.Top = 12; state.SourceWarehouse.Width = 190;
                state.DestinationWarehouse = BuildCombo(_warehouses, "name", "id");
                state.DestinationWarehouse.Left = 410; state.DestinationWarehouse.Top = 12; state.DestinationWarehouse.Width = 190;
                top.Controls.Add(warehouseLabel);
                top.Controls.Add(state.SourceWarehouse);
                top.Controls.Add(new Label { Text = "المخزن الوجهة", AutoSize = true, Top = 16, Left = 320 });
                top.Controls.Add(state.DestinationWarehouse);
            }
            else
            {
                state.Warehouse = BuildCombo(_warehouses, "name", "id");
                state.Warehouse.Left = 122; state.Warehouse.Top = 12; state.Warehouse.Width = 250;
                top.Controls.Add(warehouseLabel);
                top.Controls.Add(state.Warehouse);
            }

            top.Controls.Add(new Label { Text = "الصنف", AutoSize = true, Top = 58, Left = 14 });
            state.Item = BuildCombo(_items, "name_ar", "item_id");
            state.Item.Left = 122; state.Item.Top = 54; state.Item.Width = 270;
            top.Controls.Add(state.Item);
            top.Controls.Add(new Label { Text = "الكمية", AutoSize = true, Top = 58, Left = 410 });
            state.Quantity = new NumericUpDown { Left = 470, Top = 54, Width = 110, DecimalPlaces = 2, Maximum = 100000000, Minimum = 0.01M, Increment = 1 };
            top.Controls.Add(state.Quantity);
            top.Controls.Add(new Label { Text = "ملاحظة", AutoSize = true, Top = 96, Left = 14 });
            state.Notes = new TextBox { Left = 122, Top = 92, Width = 458 };
            top.Controls.Add(state.Notes);
            var add = new Button { Text = "إضافة للسند", Left = 610, Top = 52, Width = 120, Height = 30 };
            add.Click += delegate { AddLine(state); };
            var approve = new Button { Text = "اعتماد وحفظ", Left = 610, Top = 92, Width = 120, Height = 30, BackColor = Color.FromArgb(211, 239, 214) };
            approve.Click += delegate { ApproveDocument(state); };
            top.Controls.Add(add);
            top.Controls.Add(approve);
            page.Controls.Add(state.Lines);
            page.Controls.Add(top);
            tabs.TabPages.Add(page);
            _tabs[page] = state;
        }

        private void AddLine(MovementTabState state)
        {
            if (state.Item.SelectedIndex < 0) { MessageBox.Show("اختر الصنف أولًا."); return; }
            var row = (DataRowView)state.Item.SelectedItem;
            state.Lines.Rows.Add(row["item_id"], row["unit_id"], row["name_ar"], state.Quantity.Value, row["unit_name"], state.Notes.Text);
            state.Notes.Clear();
        }

        private void ApproveDocument(MovementTabState state)
        {
            try
            {
                var lines = new List<MovementLine>();
                foreach (DataGridViewRow row in state.Lines.Rows)
                {
                    if (row.IsNewRow) continue;
                    lines.Add(new MovementLine
                    {
                        ItemId = Convert.ToInt64(row.Cells[0].Value),
                        UnitId = Convert.ToInt64(row.Cells[1].Value),
                        ItemName = Convert.ToString(row.Cells[2].Value),
                        Quantity = Convert.ToDecimal(row.Cells[3].Value),
                        UnitName = Convert.ToString(row.Cells[4].Value),
                        Notes = Convert.ToString(row.Cells[5].Value)
                    });
                }
                if (lines.Count == 0) { MessageBox.Show("أضف صنفًا واحدًا على الأقل."); return; }
                long id;
                if (state.Kind == "RECEIPT") id = _documents.CreateApprovedReceipt(GetWarehouse(state.Warehouse), lines, state.Notes.Text);
                else if (state.Kind == "TRANSFER") id = _documents.CreateApprovedTransfer(GetWarehouse(state.SourceWarehouse), GetWarehouse(state.DestinationWarehouse), lines, state.Notes.Text);
                else if (state.Kind == "ISSUE") id = _documents.CreateApprovedIssue(GetWarehouse(state.Warehouse), lines, state.Notes.Text);
                else id = _documents.CreateApprovedConsumption(GetWarehouse(state.Warehouse), lines, state.Notes.Text);
                state.Lines.Rows.Clear();
                LoadBalances();
                MessageBox.Show("تم اعتماد المستند رقم " + id + " وتسجيل حركاته.", "تم الحفظ", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message, "تعذر اعتماد المستند", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        private static long GetWarehouse(ComboBox combo)
        {
            if (combo == null || combo.SelectedIndex < 0) throw new InvalidOperationException("اختر المخزن.");
            return Convert.ToInt64(combo.SelectedValue);
        }

        private DataTable LoadTable(string sql)
        {
            using (var command = _database.Connection.CreateCommand())
            using (var adapter = new SQLiteDataAdapter(command))
            {
                command.CommandText = sql;
                var table = new DataTable();
                adapter.Fill(table);
                return table;
            }
        }

        private static ComboBox BuildCombo(DataTable table, string display, string value)
        {
            var combo = new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList, RightToLeft = RightToLeft.Yes };
            combo.DataSource = table.Copy();
            combo.DisplayMember = display;
            combo.ValueMember = value;
            if (combo.Items.Count > 0) combo.SelectedIndex = 0;
            return combo;
        }

        private static DataGridView BuildGrid()
        {
            var grid = new DataGridView
            {
                Dock = DockStyle.Fill,
                ReadOnly = true,
                AllowUserToAddRows = false,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                BackgroundColor = Color.White,
                SelectionMode = DataGridViewSelectionMode.FullRowSelect
            };
            return grid;
        }

        private static DataGridView BuildLinesGrid()
        {
            var grid = BuildGrid();
            grid.Columns.Add(new DataGridViewTextBoxColumn { Name = "item_id", Visible = false });
            grid.Columns.Add(new DataGridViewTextBoxColumn { Name = "unit_id", Visible = false });
            grid.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "الصنف", Name = "item_name" });
            grid.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "الكمية", Name = "quantity" });
            grid.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "الوحدة", Name = "unit_name" });
            grid.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "الملاحظات", Name = "notes" });
            return grid;
        }

        private void LoadBalances()
        {
            try
            {
                using (var command = _database.Connection.CreateCommand())
                using (var adapter = new SQLiteDataAdapter(command))
                {
                    command.CommandText = @"SELECT w.name AS [المخزن], i.sku AS [SKU], i.name_ar AS [الصنف],
                        u.name_ar AS [الوحدة], COALESCE(SUM(sm.signed_quantity), 0) AS [الرصيد]
                        FROM warehouses w CROSS JOIN items i JOIN units u ON u.id=i.base_unit_id
                        LEFT JOIN stock_movements sm ON sm.warehouse_id=w.id AND sm.item_id=i.id
                        WHERE w.is_active=1 AND i.is_active=1 GROUP BY w.id,i.id,u.id
                        HAVING COALESCE(SUM(sm.signed_quantity),0)<>0 ORDER BY w.name,i.name_ar;";
                    var table = new DataTable();
                    adapter.Fill(table);
                    _balanceGrid.DataSource = table;
                    _status.Text = "محلي بالكامل | SQLite | عدد النتائج: " + table.Rows.Count;
                }
            }
            catch (Exception ex)
            {
                _status.Text = "تعذر تحميل الأرصدة";
                MessageBox.Show(ex.Message, "خطأ", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing && _database != null) _database.Dispose();
            base.Dispose(disposing);
        }
    }
}
