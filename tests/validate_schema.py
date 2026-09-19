import sqlite3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
schema = root / 'src' / 'Erb.Desktop' / 'Database' / '001_initial.sql'
conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')
conn.executescript(schema.read_text(encoding='utf-8'))

required = {
    'warehouses', 'items', 'units', 'receipts', 'receipt_lines',
    'transfers', 'transfer_lines', 'issues', 'issue_lines',
    'consumptions', 'consumption_lines', 'stock_movements',
    'inventory_counts', 'inventory_count_lines', 'audit_log',
    'license_records', 'license_local_state', 'backup_metadata'
}
actual = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
missing = required - actual
assert not missing, f'missing tables: {sorted(missing)}'

conn.execute("INSERT INTO items(sku,name_ar,normalized_name,base_unit_id) VALUES ('TEST-1','صنف اختبار','صنف اختبار',1)")
item = conn.execute("SELECT id FROM items WHERE sku='TEST-1'").fetchone()[0]
warehouse = conn.execute("SELECT id FROM warehouses WHERE code='MAIN'").fetchone()[0]
conn.execute("INSERT INTO users(username,display_name,password_hash,password_salt) VALUES ('test','Test User',X'01',X'02')")
user = conn.execute("SELECT id FROM users WHERE username='test'").fetchone()[0]
conn.execute("INSERT INTO stock_movements(movement_no,movement_type,item_id,warehouse_id,quantity,direction,signed_quantity,unit_id,source_document_type,source_document_id,user_id,occurred_at) VALUES ('OPEN-1','OPENING',?,?,?,?,?,?,?,?,?,datetime('now'))", (item, warehouse, 10, 'IN', 10, 1, 'TEST', 1, user))
assert conn.execute("SELECT SUM(signed_quantity) FROM stock_movements WHERE item_id=? AND warehouse_id=?", (item, warehouse)).fetchone()[0] == 10
try:
    conn.execute("INSERT INTO stock_movements(movement_no,movement_type,item_id,warehouse_id,quantity,direction,signed_quantity,unit_id,source_document_type,source_document_id,user_id,occurred_at) VALUES ('ISSUE-1','ISSUE',?,?,?,?,?,?,?,?,?,datetime('now'))", (item, warehouse, 11, 'OUT', -11, 1, 'TEST', 2, user))
except sqlite3.IntegrityError:
    raise AssertionError('schema should permit service-level balance rule; service enforces no-negative stock')

print('schema_tables=OK')
print('seed_data=OK')
print('foreign_keys=', conn.execute('PRAGMA foreign_keys').fetchone()[0])
