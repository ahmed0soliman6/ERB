using System;
using System.Data.SQLite;
using System.Drawing;
using System.Windows.Forms;
using Erb.Desktop.Infrastructure;

namespace Erb.Desktop
{
    internal sealed class BackupForm : Form
    {
        private readonly BackupService _backups;
        private readonly DataGridView _grid = new DataGridView();
        public BackupForm(SQLiteConnection connection)
        {
            _backups = new BackupService(connection); Text = "النسخ الاحتياطية والاستعادة"; Width = 1050; Height = 560; StartPosition = FormStartPosition.CenterParent; RightToLeft = RightToLeft.Yes; RightToLeftLayout = true; Font = new Font("Tahoma", 10F);
            _grid.Dock = DockStyle.Fill; _grid.ReadOnly = true; _grid.SelectionMode = DataGridViewSelectionMode.FullRowSelect; _grid.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill;
            var top = new Panel { Dock = DockStyle.Top, Height = 62, Padding = new Padding(10) }; var create = new Button { Text = "إنشاء نسخة الآن", Left = 10, Top = 12, Width = 130 }; create.Click += delegate { Create(); }; top.Controls.Add(create); var restore = new Button { Text = "استعادة المحددة عند إعادة التشغيل", Left = 150, Top = 12, Width = 210 }; restore.Click += delegate { Restore(); }; top.Controls.Add(restore); Controls.Add(_grid); Controls.Add(top); Load += delegate { RefreshGrid(); };
        }
        private void RefreshGrid() { _grid.DataSource = _backups.ListBackups(); }
        private void Create() { try { var file = _backups.CreateBackup("MANUAL"); RefreshGrid(); MessageBox.Show("تم إنشاء النسخة:\n" + file); } catch (Exception ex) { MessageBox.Show(ex.Message, "تعذر إنشاء النسخة", MessageBoxButtons.OK, MessageBoxIcon.Warning); } }
        private void Restore() { if (_grid.CurrentRow == null) return; try { var id = Convert.ToInt64(_grid.CurrentRow.Cells["id"].Value); var path = Convert.ToString(_grid.CurrentRow.Cells["الملف"].Value); _backups.QueueRestore(path, id); MessageBox.Show("تم التحقق من النسخة وجدولة الاستعادة. أغلق التطبيق وافتحه لتطبيقها."); } catch (Exception ex) { MessageBox.Show(ex.Message, "تعذر جدولة الاستعادة", MessageBoxButtons.OK, MessageBoxIcon.Warning); } }
    }
}
