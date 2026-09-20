using System;
using System.IO;
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
            ApplyPendingRestore();
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.ThreadException += delegate(object sender, System.Threading.ThreadExceptionEventArgs args)
            {
                MessageBox.Show(args.Exception.Message, "خطأ في النظام", MessageBoxButtons.OK, MessageBoxIcon.Error);
            };
            using (var database = new Database())
            {
                try { new BackupService(database.Connection).CreateBackup("STARTUP"); } catch { }
                var auth = new AuthService(database.Connection);
                using (var login = new LoginForm(auth))
                {
                    if (login.ShowDialog() != DialogResult.OK) return;
                    Application.Run(new MainForm(database, login.Session));
                }
            }
        }

        private static void ApplyPendingRestore()
        {
            if (!File.Exists(AppPaths.PendingRestoreFile)) return;
            if (File.Exists(AppPaths.DatabaseFile)) File.Copy(AppPaths.DatabaseFile, Path.Combine(AppPaths.BackupDirectory, "pre-restore-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + ".db"), true);
            File.Copy(AppPaths.PendingRestoreFile, AppPaths.DatabaseFile, true);
            File.Delete(AppPaths.PendingRestoreFile);
        }
    }
}
