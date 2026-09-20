using System;
using System.Windows.Forms;
using Erb.Desktop.Domain;
using Erb.Desktop.Infrastructure;

namespace Erb.Desktop
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.ThreadException += delegate(object sender, System.Threading.ThreadExceptionEventArgs args)
            {
                MessageBox.Show(args.Exception.Message, "خطأ في النظام", MessageBoxButtons.OK, MessageBoxIcon.Error);
            };
            using (var database = new Database())
            {
                var auth = new AuthService(database.Connection);
                using (var login = new LoginForm(auth))
                {
                    if (login.ShowDialog() != DialogResult.OK) return;
                    Application.Run(new MainForm(database, login.Session));
                }
            }
        }
    }
}
