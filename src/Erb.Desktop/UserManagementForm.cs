using System;
using System.Data;
using System.Drawing;
using System.Windows.Forms;
using Erb.Desktop.Domain;

namespace Erb.Desktop
{
    internal sealed class UserManagementForm : Form
    {
        private readonly AuthService _auth;
        private readonly DataGridView _grid = new DataGridView();
        private readonly TextBox _username = new TextBox();
        private readonly TextBox _display = new TextBox();
        private readonly TextBox _password = new TextBox();
        private readonly ComboBox _role = new ComboBox();
        public UserManagementForm(AuthService auth)
        {
            _auth = auth; Text = "إدارة المستخدمين والصلاحيات"; Width = 900; Height = 560; StartPosition = FormStartPosition.CenterParent; RightToLeft = RightToLeft.Yes; RightToLeftLayout = true; Font = new Font("Tahoma", 10F);
            _grid.Dock = DockStyle.Fill; _grid.ReadOnly = true; _grid.SelectionMode = DataGridViewSelectionMode.FullRowSelect; _grid.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill;
            var panel = new Panel { Dock = DockStyle.Top, Height = 135, Padding = new Padding(10) };
            AddLabel(panel, "اسم المستخدم", _username, 10); AddLabel(panel, "الاسم الظاهر", _display, 48); AddLabel(panel, "كلمة المرور", _password, 86); _password.UseSystemPasswordChar = true;
            _role.SetBounds(530, 10, 180, 28); _role.DropDownStyle = ComboBoxStyle.DropDownList; _role.Items.Add(new RoleOption("ADMIN", "مسؤول النظام")); _role.Items.Add(new RoleOption("STORE_MANAGER", "مدير مخزن")); _role.Items.Add(new RoleOption("STORE_USER", "مستخدم مخزن")); _role.Items.Add(new RoleOption("VIEWER", "مشاهد")); _role.SelectedIndex = 1; panel.Controls.Add(_role);
            var create = new Button { Text = "إضافة مستخدم", Left = 530, Top = 48, Width = 110 }; create.Click += delegate { Create(); }; panel.Controls.Add(create);
            var toggle = new Button { Text = "تفعيل/تعطيل المحدد", Left = 650, Top = 48, Width = 150 }; toggle.Click += delegate { Toggle(); }; panel.Controls.Add(toggle);
            var access = new Button { Text = "المخازن والصلاحيات", Left = 530, Top = 86, Width = 180 }; access.Click += delegate { using (var form = new AccessManagementForm(_auth)) form.ShowDialog(this); }; panel.Controls.Add(access);
            Controls.Add(_grid); Controls.Add(panel); Load += delegate { RefreshUsers(); };
        }
        private static void AddLabel(Control parent, string text, TextBox box, int top) { parent.Controls.Add(new Label { Text = text, AutoSize = true, Left = 10, Top = top + 6 }); box.SetBounds(110, top, 300, 28); parent.Controls.Add(box); }
        private void RefreshUsers() { _grid.DataSource = _auth.ListUsers(); }
        private void Create() { try { var role = (RoleOption)_role.SelectedItem; _auth.CreateUser(_username.Text, _display.Text, _password.Text, role.Code); _username.Clear(); _display.Clear(); _password.Clear(); RefreshUsers(); MessageBox.Show("تم إنشاء المستخدم."); } catch (Exception ex) { MessageBox.Show(ex.Message, "تعذر الإضافة", MessageBoxButtons.OK, MessageBoxIcon.Warning); } }
        private void Toggle() { if (_grid.CurrentRow == null) return; try { _auth.ToggleUser(Convert.ToInt64(_grid.CurrentRow.Cells["user_id"].Value)); RefreshUsers(); } catch (Exception ex) { MessageBox.Show(ex.Message); } }
        private sealed class RoleOption { public string Code; private readonly string _name; public RoleOption(string code, string name) { Code = code; _name = name; } public override string ToString() { return _name; } }
    }
}
