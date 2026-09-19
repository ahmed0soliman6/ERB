using System;
using System.IO;

namespace Erb.Desktop.Infrastructure
{
    internal static class AppPaths
    {
        public static string Root
        {
            get
            {
                var path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ERB");
                Directory.CreateDirectory(path);
                return path;
            }
        }

        public static string DatabaseFile { get { return Path.Combine(Root, "inventory.db"); } }
        public static string BackupDirectory
        {
            get
            {
                var path = Path.Combine(Root, "Backups");
                Directory.CreateDirectory(path);
                return path;
            }
        }
    }
}
