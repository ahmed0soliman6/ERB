using System;
using System.Drawing;
using System.Windows.Forms;
using Erb.Desktop.Domain;
using Erb.Desktop.Infrastructure;

namespace Erb.Desktop
{
    internal sealed class LoginForm : Form
    {
        private readonly AuthService _auth;
        private readonly TextBox _username = new TextBox();
        private readonly TextBox _password = new TextBox();
        private readonly Label _hint = new Label();
        public UserSession Session { get; private set; }

        public LoginForm(AuthService auth)
        {
            _auth = auth;
            Text = "ERB — تسجيل الدخول";
            Width = 430; Height = 330; StartPosition = FormStartPosition.CenterScreen;
            RightToLeft = RightToLeft.Yes; RightToLeftLayout = true; Font = new Font("Tahoma", 10F);
            BuildLogin();
        }

        private void BuildLogin()
        {
            var title = new Label { Text = "تسجيل الدخول إلى نظام المخازن", Font = new Font("Tahoma", 16F, FontStyle.Bold), AutoSize = true, Top = 22, Left = 80 };
            AddLabel("اسم المستخدم", 62); _username.SetBounds(150, 58, 220, 28);
            AddLabel("كلمة المرور", 104); _password.SetBounds(150, 100, 220, 28); _password.UseSystemPasswordChar = true;
            var login = new Button { Text = "دخول", Left = 150, Top = 142, Width = 100, Height = 32 };
            login.Click += delegate { Login(); };
            var setup = new Button { Text = "إنشاء المسؤول الأول", Left = 260, Top = 142, Width = 145, Height = 32 };
            setup.Click += delegate { CreateFirstAdmin(); };
            _hint.SetBounds(20, 190, 385, 80); _hint.TextAlign = ContentAlignment.MiddleCenter; _hint.ForeColor = Color.DarkSlateGray;
            Controls.Add(title); Controls.Add(_username); Controls.Add(_password); Controls.Add(login); Controls.Add(setup); Controls.Add(_hint);
            AcceptButton = login;
            if (_auth.HasUsers()) { setup.Enabled = false; _hint.Text = "أدخل بيانات المستخدم المسجل."; } else { _hint.Text = "لا يوجد مستخدم بعد. أنشئ المسؤول الأول بكلمة مرور لا تقل عن 8 أحرف."; }
        }
        private void AddLabel(string text, int top) { Controls.Add(new Label { Text = text, AutoSize = true, Left = 40, Top = top + 5 }); }
        private void Login()
        {
            try { Session = _auth.Authenticate(_username.Text, _password.Text); DialogResult = DialogResult.OK; Close(); }
            catch (Exception ex) { _hint.Text = ex.Message; _hint.ForeColor = Color.DarkRed; }
        }
        private void CreateFirstAdmin()
        {
            var confirm = new TextBox { UseSystemPasswordChar = true };
            var result = SimplePrompt.Show("تأكيد كلمة المرور", "أعد إدخال كلمة المرور:", confirm);
            if (!result) return;
            if (!string.Equals(_password.Text, confirm.Text, StringComparison.Ordinal)) { _hint.Text = "كلمتا المرور غير متطابقتين."; return; }
            try { _auth.CreateFirstAdmin(_username.Text, _username.Text, _password.Text); _hint.Text = "تم إنشاء المسؤول. اضغط دخول."; _hint.ForeColor = Color.DarkGreen; ((Button)Controls[4]).Enabled = false; }
            catch (Exception ex) { _hint.Text = ex.Message; _hint.ForeColor = Color.DarkRed; }
        }
    }

    internal static class SimplePrompt
    {
        public static bool Show(string title, string labelText, Control input)
        {
            using (var form = new Form { Text = title, Width = 360, Height = 150, StartPosition = FormStartPosition.CenterParent, RightToLeft = RightToLeft.Yes, RightToLeftLayout = true })
            {
                var label = new Label { Text = labelText, AutoSize = true, Left = 20, Top = 18 };
                input.SetBounds(20, 45, 300, 25); var ok = new Button { Text = "موافق", DialogResult = DialogResult.OK, Left = 160, Top = 80, Width = 75 }; var cancel = new Button { Text = "إلغاء", DialogResult = DialogResult.Cancel, Left = 245, Top = 80, Width = 75 };
                form.Controls.Add(label); form.Controls.Add(input); form.Controls.Add(ok); form.Controls.Add(cancel); form.AcceptButton = ok; form.CancelButton = cancel;
                return form.ShowDialog() == DialogResult.OK;
            }
        }
    }
}
