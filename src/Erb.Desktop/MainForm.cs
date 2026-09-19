using System;
using System.Data;
using System.Data.SQLite;
using System.Drawing;
using System.Windows.Forms;
using Erb.Desktop.Infrastructure;

namespace Erb.Desktop
{
    internal sealed class MainForm : Form
    {
        private readonly Database _database;
        private readonly DataGridView _grid;
        private readonly Label _status;

        public MainForm()
        {
            Text = "ERB — إدارة مخازن المجمع الطبي";
            Width = 1120;
            Height = 700;
            StartPosition = FormStartPosition.CenterScreen;
            RightToLeft = RightToLeft.Yes;
            RightToLeftLayout = true;
            Font = new Font("Tahoma", 10F);

            _database = new Database();
            _grid = new DataGridView
            {
                Dock = DockStyle.Fill,
                ReadOnly = true,
                AllowUserToAddRows = false,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                BackgroundColor = Color.White,
                SelectionMode = DataGridViewSelectionMode.FullRowSelect
            };
            _status = new Label { Dock = DockStyle.Bottom, Height = 32, TextAlign = ContentAlignment.MiddleRight };

            var header = new Panel { Dock = DockStyle.Top, Height = 86, BackColor = Color.FromArgb(33, 55, 82) };
            var title = new Label
            {
                Text = "لوحة متابعة المخزون — Offline",
                ForeColor = Color.White,
                Font = new Font("Tahoma", 18F, FontStyle.Bold),
                Dock = DockStyle.Top,
                Height = 48,
                Padding = new Padding(20, 10, 10, 0)
            };
            var refresh = new Button { Text = "تحديث الأرصدة", Width = 130, Height = 30, Top = 48, Left = 20 };
            refresh.Click += delegate { LoadBalances(); };
            header.Controls.Add(refresh);
            header.Controls.Add(title);

            Controls.Add(_grid);
            Controls.Add(_status);
            Controls.Add(header);
            Load += delegate { LoadBalances(); };
        }

        private void LoadBalances()
        {
            try
            {
                using (var command = _database.Connection.CreateCommand())
                {
                    command.CommandText = @"SELECT w.name AS [المخزن], i.sku AS [SKU], i.name_ar AS [الصنف],
                        u.name_ar AS [الوحدة], COALESCE(SUM(sm.signed_quantity), 0) AS [الرصيد]
                        FROM warehouses w
                        CROSS JOIN items i
                        JOIN units u ON u.id = i.base_unit_id
                        LEFT JOIN stock_movements sm ON sm.warehouse_id = w.id AND sm.item_id = i.id
                        WHERE w.is_active = 1 AND i.is_active = 1
                        GROUP BY w.id, i.id, u.id
                        HAVING COALESCE(SUM(sm.signed_quantity), 0) <> 0
                        ORDER BY w.name, i.name_ar;";
                    using (var adapter = new SQLiteDataAdapter(command))
                    {
                        var table = new DataTable();
                        adapter.Fill(table);
                        _grid.DataSource = table;
                        _status.Text = "محلي بالكامل | SQLite | عدد النتائج: " + table.Rows.Count;
                    }
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
