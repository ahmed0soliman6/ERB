using System;
using System.Data;
using System.Data.SQLite;
using System.IO;
using System.Linq;
using System.Security.Cryptography;

namespace Erb.Desktop.Infrastructure
{
    internal sealed class BackupService
    {
        private readonly SQLiteConnection _connection;
        public BackupService(SQLiteConnection connection) { _connection = connection; }

        public string CreateBackup(string reason)
        {
            using (var checkpoint = _connection.CreateCommand()) { checkpoint.CommandText = "PRAGMA wal_checkpoint(TRUNCATE);"; checkpoint.ExecuteNonQuery(); }
            var file = Path.Combine(AppPaths.BackupDirectory, "inventory-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + ".db");
            File.Copy(AppPaths.DatabaseFile, file, false);
            var info = new FileInfo(file); var hash = Sha256(file);
            using (var c = _connection.CreateCommand()) { c.CommandText = "INSERT INTO backup_metadata(backup_path,created_at,application_version,schema_version,file_size,sha256,verified_at) VALUES(@p,@d,@v,1,@s,@h,CURRENT_TIMESTAMP);"; c.Parameters.AddWithValue("@p", file); c.Parameters.AddWithValue("@d", DateTime.UtcNow.ToString("o")); c.Parameters.AddWithValue("@v", "1.0.0"); c.Parameters.AddWithValue("@s", info.Length); c.Parameters.AddWithValue("@h", hash); c.ExecuteNonQuery(); }
            Cleanup(14);
            return file;
        }

        public DataTable ListBackups()
        {
            var table = new DataTable();
            using (var c = _connection.CreateCommand()) using (var a = new SQLiteDataAdapter(c)) { c.CommandText = "SELECT id,backup_path AS [الملف],created_at AS [التاريخ],file_size AS [الحجم],sha256 AS [البصمة],verified_at AS [التحقق] FROM backup_metadata ORDER BY id DESC;"; a.Fill(table); }
            return table;
        }

        public void QueueRestore(string backupPath, long metadataId)
        {
            if (!File.Exists(backupPath)) throw new FileNotFoundException("ملف النسخة غير موجود.", backupPath);
            var expected = "";
            using (var c = _connection.CreateCommand()) { c.CommandText = "SELECT sha256 FROM backup_metadata WHERE id=@id;"; c.Parameters.AddWithValue("@id", metadataId); expected = Convert.ToString(c.ExecuteScalar()); }
            if (!string.Equals(expected, Sha256(backupPath), StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("فشل التحقق من بصمة النسخة الاحتياطية.");
            var pending = AppPaths.PendingRestoreFile;
            File.Copy(backupPath, pending, true);
            using (var c = _connection.CreateCommand()) { c.CommandText = "UPDATE backup_metadata SET restored_at=CURRENT_TIMESTAMP WHERE id=@id;"; c.Parameters.AddWithValue("@id", metadataId); c.ExecuteNonQuery(); }
        }

        private static string Sha256(string path)
        {
            using (var sha = SHA256.Create()) using (var stream = File.OpenRead(path)) return BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
        }
        private static void Cleanup(int keep)
        {
            var files = Directory.GetFiles(AppPaths.BackupDirectory, "inventory-*.db").OrderByDescending(File.GetCreationTimeUtc).Skip(keep);
            foreach (var file in files) try { File.Delete(file); } catch { }
        }
    }
}
