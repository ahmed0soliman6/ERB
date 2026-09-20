using System;
using System.Data.SQLite;
using System.IO;
using System.Text;

namespace Erb.Desktop.Infrastructure
{
    internal sealed class Database : IDisposable
    {
        private readonly SQLiteConnection _connection;

        public Database()
        {
            var builder = new SQLiteConnectionStringBuilder
            {
                DataSource = AppPaths.DatabaseFile,
                ForeignKeys = true,
                JournalMode = SQLiteJournalModeEnum.Wal,
                BusyTimeout = 5000
            };
            _connection = new SQLiteConnection(builder.ConnectionString);
            _connection.Open();
            ApplySchema();
        }

        public SQLiteConnection Connection { get { return _connection; } }

        private void ApplySchema()
        {
            var schemaPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Database", "001_initial.sql");
            if (!File.Exists(schemaPath))
                schemaPath = Path.Combine(AppPaths.Root, "001_initial.sql");
            if (!File.Exists(schemaPath))
                throw new FileNotFoundException("ملف مخطط قاعدة البيانات غير موجود.", schemaPath);

            using (var command = _connection.CreateCommand())
            {
                command.CommandText = File.ReadAllText(schemaPath, Encoding.UTF8);
                command.ExecuteNonQuery();
            }
            using (var check = _connection.CreateCommand())
            {
                check.CommandText = "PRAGMA table_info(items);";
                var hasReorderPoint = false;
                using (var reader = check.ExecuteReader()) while (reader.Read()) if (string.Equals(Convert.ToString(reader[1]), "reorder_point", StringComparison.OrdinalIgnoreCase)) hasReorderPoint = true;
                if (!hasReorderPoint)
                {
                    using (var alter = _connection.CreateCommand()) { alter.CommandText = "ALTER TABLE items ADD COLUMN reorder_point NUMERIC NOT NULL DEFAULT 0;"; alter.ExecuteNonQuery(); }
                }
            }
        }

        public SQLiteTransaction BeginTransaction()
        {
            return _connection.BeginTransaction();
        }

        public void Dispose()
        {
            _connection.Dispose();
        }
    }
}
