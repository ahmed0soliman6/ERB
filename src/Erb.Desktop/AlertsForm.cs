using System;
using System.Drawing;
using System.Windows.Forms;
using Erb.Desktop.Domain;
using System.Data.SQLite;

namespace Erb.Desktop
{
    internal sealed class AlertsForm : Form
    {
        private readonly AlertService _alerts;
        private readonly DataGridView _grid = new DataGridView();
        private readonly Label _summary = new Label();
        public AlertsForm(SQLiteConnection connection, UserSession session)
        {
            _alerts = new AlertService(connection, session); Text = "تنبيهات المخزون — SoliMedical-ERB"; Width = 1040; Height = 570; StartPosition = FormStartPosition.CenterParent; RightToLeft = RightToLeft.Yes; RightToLeftLayout = true; Font = new Font("Tahoma", 10F);
            _grid.Dock = DockStyle.Fill; _grid.ReadOnly = true; _grid.AllowUserToAddRows = false; _grid.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill; _grid.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
            var top = new Panel { Dock = DockStyle.Top, Height = 64, Padding = new Padding(12), BackColor = Color.FromArgb(255, 247, 237) }; _summary.Dock = DockStyle.Fill; _summary.Font = new Font("Tahoma", 11F, FontStyle.Bold); _summary.ForeColor = Color.FromArgb(154, 52, 18); top.Controls.Add(_summary); var refresh = new Button { Text = "تحديث", Width = 90, Height = 28, Dock = DockStyle.Left }; refresh.Click += delegate { LoadAlerts(); }; top.Controls.Add(refresh); Controls.Add(_grid); Controls.Add(top); Load += delegate { LoadAlerts(); };
        }
        private void LoadAlerts() { var table = _alerts.ListAlerts(); _grid.DataSource = table; _summary.Text = table.Rows.Count == 0 ? "لا توجد تنبيهات — المخزون ضمن الحدود المحددة." : "يوجد " + table.Rows.Count + " تنبيهًا يحتاج إلى مراجعة وإعادة طلب."; }
    }
}
