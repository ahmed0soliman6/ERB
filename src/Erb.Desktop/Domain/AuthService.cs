using System;
using System.Collections.Generic;
using System.Data.SQLite;
using System.Security.Cryptography;
using System.Text;

namespace Erb.Desktop.Domain
{
    internal sealed class UserSession
    {
        private readonly HashSet<string> _permissions;
        public long UserId { get; private set; }
        public string Username { get; private set; }
        public string DisplayName { get; private set; }
        public string RoleCode { get; private set; }
        public bool IsAdmin { get { return string.Equals(RoleCode, "ADMIN", StringComparison.OrdinalIgnoreCase); } }
        public UserSession(long userId, string username, string displayName, string roleCode, IEnumerable<string> permissions)
        {
            UserId = userId; Username = username; DisplayName = displayName; RoleCode = roleCode;
            _permissions = new HashSet<string>(permissions, StringComparer.OrdinalIgnoreCase);
        }
        public bool Can(string permission) { return IsAdmin || _permissions.Contains(permission); }
    }

    internal sealed class AuthService
    {
        private readonly SQLiteConnection _connection;
        private const int Iterations = 100000;
        public AuthService(SQLiteConnection connection) { _connection = connection; SeedPermissions(); }

        public bool HasUsers()
        {
            using (var c = _connection.CreateCommand()) { c.CommandText = "SELECT COUNT(*) FROM users;"; return Convert.ToInt32(c.ExecuteScalar()) > 0; }
        }

        public void CreateFirstAdmin(string username, string displayName, string password)
        {
            if (HasUsers()) throw new InvalidOperationException("تم إنشاء المستخدم الأول بالفعل.");
            if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password) || password.Length < 8)
                throw new InvalidOperationException("اسم المستخدم مطلوب وكلمة المرور يجب ألا تقل عن 8 أحرف.");
            byte[] salt, hash; HashPassword(password, out salt, out hash);
            using (var tx = _connection.BeginTransaction())
            {
                using (var c = _connection.CreateCommand())
                {
                    c.Transaction = tx; c.CommandText = "INSERT INTO users(username,display_name,password_hash,password_salt) VALUES(@u,@d,@h,@s); SELECT last_insert_rowid();";
                    c.Parameters.AddWithValue("@u", username.Trim()); c.Parameters.AddWithValue("@d", string.IsNullOrWhiteSpace(displayName) ? username.Trim() : displayName.Trim()); c.Parameters.AddWithValue("@h", hash); c.Parameters.AddWithValue("@s", salt);
                    var userId = Convert.ToInt64(c.ExecuteScalar());
                    using (var role = _connection.CreateCommand()) { role.Transaction = tx; role.CommandText = "INSERT INTO user_roles(user_id,role_id) SELECT @u,id FROM roles WHERE code='ADMIN';"; role.Parameters.AddWithValue("@u", userId); role.ExecuteNonQuery(); }
                }
                tx.Commit();
            }
        }

        public UserSession Authenticate(string username, string password)
        {
            using (var c = _connection.CreateCommand())
            {
                c.CommandText = "SELECT id,username,display_name,password_hash,password_salt FROM users WHERE username=@u AND is_active=1;";
                c.Parameters.AddWithValue("@u", username.Trim());
                using (var r = c.ExecuteReader())
                {
                    if (!r.Read()) throw new InvalidOperationException("اسم المستخدم أو كلمة المرور غير صحيحة.");
                    var salt = (byte[])r[4]; var expected = (byte[])r[3]; byte[] actual;
                    using (var pbkdf = new Rfc2898DeriveBytes(password, salt, Iterations)) actual = pbkdf.GetBytes(expected.Length);
                    if (!FixedEquals(expected, actual)) throw new InvalidOperationException("اسم المستخدم أو كلمة المرور غير صحيحة.");
                    var session = new UserSession(Convert.ToInt64(r[0]), Convert.ToString(r[1]), Convert.ToString(r[2]), LoadRole(Convert.ToInt64(r[0])), LoadPermissions(Convert.ToInt64(r[0])));
                    r.Close();
                    using (var update = _connection.CreateCommand()) { update.CommandText = "UPDATE users SET last_login_at=CURRENT_TIMESTAMP WHERE id=@id;"; update.Parameters.AddWithValue("@id", session.UserId); update.ExecuteNonQuery(); }
                    return session;
                }
            }
        }

        public System.Data.DataTable ListUsers()
        {
            var table = new System.Data.DataTable();
            using (var c = _connection.CreateCommand()) using (var a = new SQLiteDataAdapter(c))
            {
                c.CommandText = "SELECT u.id AS user_id,u.username AS [اسم المستخدم],u.display_name AS [الاسم],CASE u.is_active WHEN 1 THEN 'نشط' ELSE 'معطل' END AS [الحالة],COALESCE(r.name,'بدون دور') AS [الدور] FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id LEFT JOIN roles r ON r.id=ur.role_id ORDER BY u.id;";
                a.Fill(table);
            }
            return table;
        }

        public void CreateUser(string username, string displayName, string password, string roleCode)
        {
            if (string.IsNullOrWhiteSpace(username) || password == null || password.Length < 8) throw new InvalidOperationException("اسم المستخدم مطلوب وكلمة المرور يجب ألا تقل عن 8 أحرف.");
            byte[] salt, hash; HashPassword(password, out salt, out hash);
            using (var tx = _connection.BeginTransaction())
            {
                long id;
                using (var c = _connection.CreateCommand()) { c.Transaction = tx; c.CommandText = "INSERT INTO users(username,display_name,password_hash,password_salt) VALUES(@u,@d,@h,@s); SELECT last_insert_rowid();"; c.Parameters.AddWithValue("@u", username.Trim()); c.Parameters.AddWithValue("@d", string.IsNullOrWhiteSpace(displayName) ? username.Trim() : displayName.Trim()); c.Parameters.AddWithValue("@h", hash); c.Parameters.AddWithValue("@s", salt); id = Convert.ToInt64(c.ExecuteScalar()); }
                using (var c = _connection.CreateCommand()) { c.Transaction = tx; c.CommandText = "INSERT INTO user_roles(user_id,role_id) SELECT @u,id FROM roles WHERE code=@r;"; c.Parameters.AddWithValue("@u", id); c.Parameters.AddWithValue("@r", roleCode); c.ExecuteNonQuery(); }
                tx.Commit();
            }
        }

        public void ToggleUser(long userId)
        {
            using (var c = _connection.CreateCommand()) { c.CommandText = "UPDATE users SET is_active=CASE is_active WHEN 1 THEN 0 ELSE 1 END,updated_at=CURRENT_TIMESTAMP WHERE id=@id;"; c.Parameters.AddWithValue("@id", userId); c.ExecuteNonQuery(); }
        }

        private string LoadRole(long userId)
        {
            using (var c = _connection.CreateCommand()) { c.CommandText = "SELECT COALESCE((SELECT r.code FROM roles r JOIN user_roles ur ON ur.role_id=r.id WHERE ur.user_id=@u LIMIT 1),'VIEWER');"; c.Parameters.AddWithValue("@u", userId); return Convert.ToString(c.ExecuteScalar()); }
        }
        private List<string> LoadPermissions(long userId)
        {
            var result = new List<string>();
            using (var c = _connection.CreateCommand()) { c.CommandText = "SELECT p.code FROM permissions p JOIN role_permissions rp ON rp.permission_id=p.id JOIN user_roles ur ON ur.role_id=rp.role_id WHERE ur.user_id=@u;"; c.Parameters.AddWithValue("@u", userId); using (var r = c.ExecuteReader()) while (r.Read()) result.Add(Convert.ToString(r[0])); }
            return result;
        }
        private void SeedPermissions()
        {
            var permissions = new[] { "RECEIPTS.CREATE", "RECEIPTS.APPROVE", "TRANSFERS.CREATE", "TRANSFERS.APPROVE", "ISSUES.CREATE", "ISSUES.APPROVE", "CONSUMPTIONS.CREATE", "CONSUMPTIONS.APPROVE", "REPORTS.VIEW", "USERS.MANAGE", "BACKUP.CREATE" };
            using (var tx = _connection.BeginTransaction())
            {
                foreach (var p in permissions) using (var c = _connection.CreateCommand()) { c.Transaction = tx; c.CommandText = "INSERT OR IGNORE INTO permissions(code,name) VALUES(@c,@n);"; c.Parameters.AddWithValue("@c", p); c.Parameters.AddWithValue("@n", p); c.ExecuteNonQuery(); }
                using (var c = _connection.CreateCommand()) { c.Transaction = tx; c.CommandText = "INSERT OR IGNORE INTO role_permissions(role_id,permission_id) SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.code='ADMIN';"; c.ExecuteNonQuery(); }
                tx.Commit();
            }
        }
        private static void HashPassword(string password, out byte[] salt, out byte[] hash)
        {
            using (var rng = RandomNumberGenerator.Create()) { salt = new byte[16]; rng.GetBytes(salt); }
            using (var pbkdf = new Rfc2898DeriveBytes(password, salt, Iterations)) hash = pbkdf.GetBytes(32);
        }
        private static bool FixedEquals(byte[] a, byte[] b) { if (a == null || b == null || a.Length != b.Length) return false; int diff = 0; for (int i = 0; i < a.Length; i++) diff |= a[i] ^ b[i]; return diff == 0; }
    }
}
