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
        private readonly UserSession _session;
        private readonly DataGridView _balanceGrid;
        private readonly Label _status;
        private readonly DataTable _items;
        private readonly DataTable _warehouses;
        private readonly Dictionary<TabPage, MovementTabState> _tabs = new Dictionary<TabPage, MovementTabState>();
        private sealed class MovementTabState { public string Kind; public long DocumentId; public ComboBox Drafts, Warehouse, SourceWarehouse, DestinationWarehouse, Item; public NumericUpDown Quantity; public TextBox Notes; public DataGridView Lines; public Button Save, Open, Approve; }

        public MainForm(Database database, UserSession session)
        {
            _database = database; _session = session; _documents = new DocumentService(database.Connection);
            Text = "ERB — إدارة مخازن المجمع الطبي | " + session.DisplayName; Width = 1240; Height = 780; StartPosition = FormStartPosition.CenterScreen; RightToLeft = RightToLeft.Yes; RightToLeftLayout = true; Font = new Font("Tahoma", 10F);
            _items = LoadTable("SELECT i.id AS item_id,i.name_ar,i.base_unit_id AS unit_id,u.name_ar AS unit_name FROM items i JOIN units u ON u.id=i.base_unit_id WHERE i.is_active=1 ORDER BY i.name_ar;");
            _warehouses = LoadTable("SELECT id,name FROM warehouses WHERE is_active=1 ORDER BY name;"); _balanceGrid = BuildGrid(); _status = new Label { Dock = DockStyle.Bottom, Height = 32, TextAlign = ContentAlignment.MiddleRight };
            var header = new Panel { Dock = DockStyle.Top, Height = 78, BackColor = Color.FromArgb(33,55,82) }; var title = new Label { Text = "إدارة المخزون — Offline | " + session.RoleCode, ForeColor = Color.White, Font = new Font("Tahoma",18F,FontStyle.Bold), Dock = DockStyle.Top, Height = 46, Padding = new Padding(20,8,10,0) }; var refresh = new Button { Text = "تحديث الأرصدة", Width = 130, Height = 28, Top = 45, Left = 20 }; refresh.Click += delegate { LoadBalances(); }; header.Controls.Add(refresh);
            if (session.Can("USERS.MANAGE")) { var users = new Button { Text = "إدارة المستخدمين", Width = 140, Height = 28, Top = 45, Left = 165 }; users.Click += delegate { using (var form = new UserManagementForm(new AuthService(_database.Connection))) form.ShowDialog(this); }; header.Controls.Add(users); }
            header.Controls.Add(title);
            var tabs = new TabControl { Dock = DockStyle.Fill }; var balance = new TabPage("الأرصدة الحالية"); balance.Controls.Add(_balanceGrid); tabs.TabPages.Add(balance); AddMovementTab(tabs,"RECEIPT","التوريد"); AddMovementTab(tabs,"TRANSFER","التحويل بين المخازن"); AddMovementTab(tabs,"ISSUE","الصرف"); AddMovementTab(tabs,"CONSUMPTION","الاستهلاك"); tabs.SelectedIndexChanged += delegate { LoadBalances(); };
            Controls.Add(tabs); Controls.Add(_status); Controls.Add(header); Load += delegate { LoadBalances(); };
        }

        private void AddMovementTab(TabControl tabs, string kind, string title)
        {
            var page = new TabPage(title); var state = new MovementTabState { Kind = kind, Lines = BuildLinesGrid() }; var top = new Panel { Dock = DockStyle.Top, Height = 190, Padding = new Padding(12) };
            top.Controls.Add(new Label { Text = "المسودات المحفوظة", AutoSize = true, Top = 16, Left = 14 }); state.Drafts = new ComboBox { Left = 122, Top = 12, Width = 350, DropDownStyle = ComboBoxStyle.DropDownList }; top.Controls.Add(state.Drafts);
            state.Open = new Button { Text = "فتح المسودة", Left = 485, Top = 11, Width = 110 }; state.Open.Click += delegate { OpenDraft(state); }; top.Controls.Add(state.Open);
            var warehouseLabel = new Label { Text = kind == "TRANSFER" ? "المخزن المصدر" : "المخزن", AutoSize = true, Top = 56, Left = 14 }; top.Controls.Add(warehouseLabel);
            if (kind == "TRANSFER") { state.SourceWarehouse = BuildCombo(_warehouses,"name","id"); state.SourceWarehouse.SetBounds(122,52,190,28); state.DestinationWarehouse = BuildCombo(_warehouses,"name","id"); state.DestinationWarehouse.SetBounds(410,52,190,28); top.Controls.Add(state.SourceWarehouse); top.Controls.Add(new Label { Text = "المخزن الوجهة", AutoSize = true, Top = 56, Left = 320 }); top.Controls.Add(state.DestinationWarehouse); } else { state.Warehouse = BuildCombo(_warehouses,"name","id"); state.Warehouse.SetBounds(122,52,250,28); top.Controls.Add(state.Warehouse); }
            top.Controls.Add(new Label { Text = "الصنف", AutoSize = true, Top = 94, Left = 14 }); state.Item = BuildCombo(_items,"name_ar","item_id"); state.Item.SetBounds(122,90,270,28); top.Controls.Add(state.Item); top.Controls.Add(new Label { Text = "الكمية", AutoSize = true, Top = 94, Left = 410 }); state.Quantity = new NumericUpDown { Left = 470, Top = 90, Width = 110, DecimalPlaces = 2, Maximum = 100000000, Minimum = .01M }; top.Controls.Add(state.Quantity);
            top.Controls.Add(new Label { Text = "ملاحظة", AutoSize = true, Top = 132, Left = 14 }); state.Notes = new TextBox { Left = 122, Top = 128, Width = 458 }; top.Controls.Add(state.Notes);
            var add = new Button { Text = "إضافة للسند", Left = 610, Top = 88, Width = 120 }; add.Click += delegate { AddLine(state); }; top.Controls.Add(add); state.Save = new Button { Text = "حفظ كمسودة", Left = 610, Top = 128, Width = 120 }; state.Save.Click += delegate { SaveDraft(state); }; top.Controls.Add(state.Save); state.Approve = new Button { Text = "اعتماد المسودة", Left = 740, Top = 128, Width = 120, BackColor = Color.FromArgb(211,239,214) }; state.Approve.Click += delegate { ApproveDraft(state); }; top.Controls.Add(state.Approve);
            page.Controls.Add(state.Lines); page.Controls.Add(top); tabs.TabPages.Add(page); _tabs[page] = state; ApplyPermissions(state); LoadDrafts(state);
        }

        private void ApplyPermissions(MovementTabState s) { string p = s.Kind == "RECEIPT" ? "RECEIPTS" : s.Kind == "TRANSFER" ? "TRANSFERS" : s.Kind == "ISSUE" ? "ISSUES" : "CONSUMPTIONS"; s.Save.Enabled = _session.Can(p + ".CREATE"); s.Open.Enabled = s.Save.Enabled; s.Approve.Enabled = _session.Can(p + ".APPROVE"); }
        private void LoadDrafts(MovementTabState s) { var table = _documents.ListDrafts(s.Kind,_session.UserId); s.Drafts.DataSource = table; s.Drafts.DisplayMember = "display_name"; s.Drafts.ValueMember = "id"; if (table.Rows.Count > 0) s.Drafts.SelectedIndex = 0; }
        private void AddLine(MovementTabState s) { if (s.Item.SelectedIndex < 0) { MessageBox.Show("اختر الصنف أولًا."); return; } var row = (DataRowView)s.Item.SelectedItem; s.Lines.Rows.Add(row["item_id"],row["unit_id"],row["name_ar"],s.Quantity.Value,row["unit_name"],s.Notes.Text); s.Notes.Clear(); }
        private List<MovementLine> ReadLines(MovementTabState s) { var list = new List<MovementLine>(); foreach (DataGridViewRow r in s.Lines.Rows) if (!r.IsNewRow) list.Add(new MovementLine { ItemId=Convert.ToInt64(r.Cells[0].Value), UnitId=Convert.ToInt64(r.Cells[1].Value), ItemName=Convert.ToString(r.Cells[2].Value), Quantity=Convert.ToDecimal(r.Cells[3].Value), UnitName=Convert.ToString(r.Cells[4].Value), Notes=Convert.ToString(r.Cells[5].Value) }); return list; }
        private void SaveDraft(MovementTabState s) { try { var lines=ReadLines(s); if(lines.Count==0) throw new InvalidOperationException("أضف صنفًا واحدًا على الأقل."); long warehouse=s.Kind=="TRANSFER"?GetWarehouse(s.SourceWarehouse):GetWarehouse(s.Warehouse); long destination=s.Kind=="TRANSFER"?GetWarehouse(s.DestinationWarehouse):0; s.DocumentId=_documents.SaveDraft(s.Kind,s.DocumentId,warehouse,destination,lines,s.Notes.Text,_session.UserId); LoadDrafts(s); SelectDraft(s,s.DocumentId); _status.Text="تم حفظ المسودة رقم "+s.DocumentId; } catch(Exception ex) { MessageBox.Show(ex.Message,"تعذر حفظ المسودة",MessageBoxButtons.OK,MessageBoxIcon.Warning); } }
        private void OpenDraft(MovementTabState s) { try { if(s.Drafts.SelectedIndex<0)return; var d=_documents.LoadDraft(s.Kind,Convert.ToInt64(s.Drafts.SelectedValue),_session.UserId); s.DocumentId=d.Id; if(s.Kind=="TRANSFER"){s.SourceWarehouse.SelectedValue=d.SourceWarehouseId;s.DestinationWarehouse.SelectedValue=d.DestinationWarehouseId;}else s.Warehouse.SelectedValue=d.WarehouseId; s.Notes.Text=d.Notes; s.Lines.Rows.Clear(); foreach(var l in d.Lines)s.Lines.Rows.Add(l.ItemId,l.UnitId,l.ItemName,l.Quantity,l.UnitName,l.Notes); _status.Text="تم فتح المسودة رقم "+d.Id; } catch(Exception ex){MessageBox.Show(ex.Message,"تعذر فتح المسودة",MessageBoxButtons.OK,MessageBoxIcon.Warning);} }
        private void ApproveDraft(MovementTabState s) { try { if(s.DocumentId==0){SaveDraft(s); if(s.DocumentId==0)return;} if(MessageBox.Show("اعتماد المسودة وإنشاء حركات المخزون؟","تأكيد الاعتماد",MessageBoxButtons.YesNo,MessageBoxIcon.Question)!=DialogResult.Yes)return; _documents.ApproveDraft(s.Kind,s.DocumentId,_session.UserId); _status.Text="تم اعتماد المستند رقم "+s.DocumentId; s.DocumentId=0;s.Lines.Rows.Clear();s.Notes.Clear();LoadDrafts(s);LoadBalances(); } catch(Exception ex){MessageBox.Show(ex.Message,"تعذر اعتماد المسودة",MessageBoxButtons.OK,MessageBoxIcon.Warning);} }
        private static void SelectDraft(MovementTabState s,long id){ for(int i=0;i<s.Drafts.Items.Count;i++){s.Drafts.SelectedIndex=i;if(Convert.ToInt64(s.Drafts.SelectedValue)==id)return;} }
        private static long GetWarehouse(ComboBox c){if(c==null||c.SelectedIndex<0)throw new InvalidOperationException("اختر المخزن.");return Convert.ToInt64(c.SelectedValue);}
        private DataTable LoadTable(string sql){using(var c=_database.Connection.CreateCommand())using(var a=new SQLiteDataAdapter(c)){c.CommandText=sql;var t=new DataTable();a.Fill(t);return t;}}
        private static ComboBox BuildCombo(DataTable t,string display,string value){var c=new ComboBox{DropDownStyle=ComboBoxStyle.DropDownList,RightToLeft=RightToLeft.Yes};c.DataSource=t.Copy();c.DisplayMember=display;c.ValueMember=value;if(c.Items.Count>0)c.SelectedIndex=0;return c;}
        private static DataGridView BuildGrid(){return new DataGridView{Dock=DockStyle.Fill,ReadOnly=true,AllowUserToAddRows=false,AutoSizeColumnsMode=DataGridViewAutoSizeColumnsMode.Fill,BackgroundColor=Color.White,SelectionMode=DataGridViewSelectionMode.FullRowSelect};}
        private static DataGridView BuildLinesGrid(){var g=BuildGrid();g.Columns.Add(new DataGridViewTextBoxColumn{Name="item_id",Visible=false});g.Columns.Add(new DataGridViewTextBoxColumn{Name="unit_id",Visible=false});g.Columns.Add(new DataGridViewTextBoxColumn{HeaderText="الصنف",Name="item_name"});g.Columns.Add(new DataGridViewTextBoxColumn{HeaderText="الكمية",Name="quantity"});g.Columns.Add(new DataGridViewTextBoxColumn{HeaderText="الوحدة",Name="unit_name"});g.Columns.Add(new DataGridViewTextBoxColumn{HeaderText="الملاحظات",Name="notes"});return g;}
        private void LoadBalances(){try{using(var c=_database.Connection.CreateCommand())using(var a=new SQLiteDataAdapter(c)){c.CommandText="SELECT w.name AS [المخزن],i.sku AS [SKU],i.name_ar AS [الصنف],u.name_ar AS [الوحدة],COALESCE(SUM(sm.signed_quantity),0) AS [الرصيد] FROM warehouses w CROSS JOIN items i JOIN units u ON u.id=i.base_unit_id LEFT JOIN stock_movements sm ON sm.warehouse_id=w.id AND sm.item_id=i.id WHERE w.is_active=1 AND i.is_active=1 GROUP BY w.id,i.id,u.id HAVING COALESCE(SUM(sm.signed_quantity),0)<>0 ORDER BY w.name,i.name_ar;";var t=new DataTable();a.Fill(t);_balanceGrid.DataSource=t;_status.Text="محلي بالكامل | SQLite | المستخدم: "+_session.DisplayName+" | النتائج: "+t.Rows.Count;}}catch(Exception ex){MessageBox.Show(ex.Message,"خطأ",MessageBoxButtons.OK,MessageBoxIcon.Error);}}
    }
}
