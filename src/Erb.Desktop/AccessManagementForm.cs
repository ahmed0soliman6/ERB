using System;
using System.Collections.Generic;
using System.Data;
using System.Drawing;
using System.Windows.Forms;
using Erb.Desktop.Domain;

namespace Erb.Desktop
{
    internal sealed class AccessManagementForm : Form
    {
        private readonly AuthService _auth;
        private readonly ComboBox _user = new ComboBox();
        private readonly CheckedListBox _warehouses = new CheckedListBox();
        private readonly ComboBox _role = new ComboBox();
        private readonly CheckedListBox _permissions = new CheckedListBox();
        private DataTable _userTable;
        private DataTable _warehouseTable;
        private DataTable _roleTable;
        private DataTable _permissionTable;

        public AccessManagementForm(AuthService auth)
        {
            _auth = auth; Text = "تخصيص المخازن وإدارة الصلاحيات التفصيلية"; Width = 850; Height = 620; StartPosition = FormStartPosition.CenterParent; RightToLeft = RightToLeft.Yes; RightToLeftLayout = true; Font = new Font("Tahoma", 10F);
            BuildUi(); Load += delegate { LoadData(); };
        }

        private void BuildUi()
        {
            var tabs = new TabControl { Dock = DockStyle.Fill };
            var warehousePage = new TabPage("مخازن المستخدمين");
            warehousePage.Controls.Add(new Label { Text = "المستخدم", AutoSize = true, Left = 20, Top = 22 });
            _user.SetBounds(110, 18, 300, 28); _user.DropDownStyle = ComboBoxStyle.DropDownList; _user.SelectedIndexChanged += delegate { LoadUserWarehouses(); }; warehousePage.Controls.Add(_user);
            _warehouses.SetBounds(20, 70, 390, 410); _warehouses.CheckOnClick = true; warehousePage.Controls.Add(_warehouses);
            var saveWarehouses = new Button { Text = "حفظ المخازن المخصصة", Left = 20, Top = 500, Width = 180 }; saveWarehouses.Click += delegate { SaveUserWarehouses(); }; warehousePage.Controls.Add(saveWarehouses);
            var rolePage = new TabPage("صلاحيات الأدوار"); rolePage.Controls.Add(new Label { Text = "الدور", AutoSize = true, Left = 20, Top = 22 }); _role.SetBounds(90, 18, 300, 28); _role.DropDownStyle = ComboBoxStyle.DropDownList; _role.SelectedIndexChanged += delegate { LoadRolePermissions(); }; rolePage.Controls.Add(_role);
            _permissions.SetBounds(20, 70, 600, 410); _permissions.CheckOnClick = true; rolePage.Controls.Add(_permissions);
            var savePermissions = new Button { Text = "حفظ صلاحيات الدور", Left = 20, Top = 500, Width = 180 }; savePermissions.Click += delegate { SaveRolePermissions(); }; rolePage.Controls.Add(savePermissions);
            tabs.TabPages.Add(warehousePage); tabs.TabPages.Add(rolePage); Controls.Add(tabs);
        }

        private void LoadData()
        {
            _userTable = _auth.ListUsers(); _user.DataSource = _userTable; _user.DisplayMember = "الاسم"; _user.ValueMember = "user_id";
            _warehouseTable = _auth.ListWarehouses(); _warehouses.Items.Clear(); foreach (DataRow row in _warehouseTable.Rows) _warehouses.Items.Add(new Choice(Convert.ToInt64(row["id"]), Convert.ToString(row["name"])));
            _roleTable = _auth.ListRoles(); _role.DataSource = _roleTable; _role.DisplayMember = "name"; _role.ValueMember = "code";
            _permissionTable = _auth.ListPermissions(); _permissions.Items.Clear(); foreach (DataRow row in _permissionTable.Rows) _permissions.Items.Add(new Choice(Convert.ToString(row["code"]), Convert.ToString(row["name"])));
            LoadUserWarehouses(); LoadRolePermissions();
        }

        private void LoadUserWarehouses()
        {
            if (_user.SelectedIndex < 0) return; var selected = _auth.GetUserWarehouses(Convert.ToInt64(_user.SelectedValue)); for (int i = 0; i < _warehouses.Items.Count; i++) { var item = (Choice)_warehouses.Items[i]; _warehouses.SetItemChecked(i, selected.Contains(Convert.ToInt64(item.Value))); }
        }
        private void LoadRolePermissions()
        {
            if (_role.SelectedIndex < 0) return; var selected = _auth.GetRolePermissions(Convert.ToString(_role.SelectedValue)); for (int i = 0; i < _permissions.Items.Count; i++) { var item = (Choice)_permissions.Items[i]; _permissions.SetItemChecked(i, selected.Contains(Convert.ToString(item.Value))); }
        }
        private void SaveUserWarehouses()
        {
            if (_user.SelectedIndex < 0) return; var ids = new List<long>(); foreach (Choice item in _warehouses.CheckedItems) ids.Add(Convert.ToInt64(item.Value)); _auth.SetUserWarehouses(Convert.ToInt64(_user.SelectedValue), ids); MessageBox.Show("تم حفظ المخازن المخصصة للمستخدم.");
        }
        private void SaveRolePermissions()
        {
            if (_role.SelectedIndex < 0) return; var codes = new List<string>(); foreach (Choice item in _permissions.CheckedItems) codes.Add(Convert.ToString(item.Value)); _auth.SetRolePermissions(Convert.ToString(_role.SelectedValue), codes); MessageBox.Show("تم حفظ الصلاحيات التفصيلية للدور.");
        }
        private sealed class Choice
        {
            public object Value; private readonly string _text; public Choice(object value, string text) { Value = value; _text = text; } public override string ToString() { return _text; }
        }
    }
}
