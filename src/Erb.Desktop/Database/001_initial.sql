PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL COLLATE NOCASE UNIQUE,
    name TEXT NOT NULL,
    warehouse_type TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER REFERENCES categories(id),
    code TEXT NOT NULL COLLATE NOCASE UNIQUE,
    name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1))
);

CREATE TABLE IF NOT EXISTS units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL COLLATE NOCASE UNIQUE,
    name_ar TEXT NOT NULL UNIQUE,
    name_en TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1))
);

CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT NOT NULL COLLATE NOCASE UNIQUE,
    name_ar TEXT NOT NULL,
    normalized_name TEXT NOT NULL COLLATE NOCASE,
    category_id INTEGER REFERENCES categories(id),
    base_unit_id INTEGER NOT NULL REFERENCES units(id),
    notes TEXT,
    minimum_stock NUMERIC NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
    expiry_tracking INTEGER NOT NULL DEFAULT 0 CHECK (expiry_tracking IN (0,1)),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_items_normalized_name ON items(normalized_name);

CREATE TABLE IF NOT EXISTS item_warehouse_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL REFERENCES items(id),
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    minimum_stock_override NUMERIC CHECK (minimum_stock_override IS NULL OR minimum_stock_override >= 0),
    is_allowed INTEGER NOT NULL DEFAULT 1 CHECK (is_allowed IN (0,1)),
    notes TEXT,
    UNIQUE(item_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL COLLATE NOCASE UNIQUE,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1))
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    display_name TEXT NOT NULL,
    password_hash BLOB NOT NULL,
    password_salt BLOB NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
    last_login_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL COLLATE NOCASE UNIQUE,
    name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL COLLATE NOCASE UNIQUE,
    name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER NOT NULL REFERENCES users(id),
    role_id INTEGER NOT NULL REFERENCES roles(id),
    PRIMARY KEY(user_id, role_id)
);
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER NOT NULL REFERENCES roles(id),
    permission_id INTEGER NOT NULL REFERENCES permissions(id),
    PRIMARY KEY(role_id, permission_id)
);
CREATE TABLE IF NOT EXISTS user_warehouses (
    user_id INTEGER NOT NULL REFERENCES users(id),
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    PRIMARY KEY(user_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS movement_reasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL COLLATE NOCASE UNIQUE,
    name TEXT NOT NULL,
    movement_type TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1))
);

CREATE TABLE IF NOT EXISTS receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_no TEXT NOT NULL COLLATE NOCASE UNIQUE,
    document_date TEXT NOT NULL,
    destination_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    supplier_id INTEGER REFERENCES suppliers(id),
    reference_no TEXT,
    receipt_type TEXT NOT NULL DEFAULT 'RECEIPT',
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','APPROVED','VOIDED')),
    created_by INTEGER NOT NULL REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    approved_at TEXT,
    voided_by INTEGER REFERENCES users(id),
    voided_at TEXT,
    void_reason TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS receipt_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_id INTEGER NOT NULL REFERENCES receipts(id),
    item_id INTEGER NOT NULL REFERENCES items(id),
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit_id INTEGER NOT NULL REFERENCES units(id),
    unit_cost NUMERIC CHECK (unit_cost IS NULL OR unit_cost >= 0),
    batch_no TEXT,
    expiry_date TEXT,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_no TEXT NOT NULL COLLATE NOCASE UNIQUE,
    document_date TEXT NOT NULL,
    source_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    destination_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    reason_id INTEGER REFERENCES movement_reasons(id),
    reference_no TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','APPROVED','VOIDED')),
    created_by INTEGER NOT NULL REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    approved_at TEXT,
    voided_by INTEGER REFERENCES users(id),
    voided_at TEXT,
    void_reason TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (source_warehouse_id <> destination_warehouse_id)
);
CREATE TABLE IF NOT EXISTS transfer_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transfer_id INTEGER NOT NULL REFERENCES transfers(id),
    item_id INTEGER NOT NULL REFERENCES items(id),
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit_id INTEGER NOT NULL REFERENCES units(id),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_no TEXT NOT NULL COLLATE NOCASE UNIQUE,
    document_date TEXT NOT NULL,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    issued_to TEXT,
    department TEXT,
    reason_id INTEGER REFERENCES movement_reasons(id),
    reference_no TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','APPROVED','VOIDED')),
    created_by INTEGER NOT NULL REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    approved_at TEXT,
    voided_by INTEGER REFERENCES users(id),
    voided_at TEXT,
    void_reason TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS issue_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id INTEGER NOT NULL REFERENCES issues(id),
    item_id INTEGER NOT NULL REFERENCES items(id),
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit_id INTEGER NOT NULL REFERENCES units(id),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS consumptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_no TEXT NOT NULL COLLATE NOCASE UNIQUE,
    document_date TEXT NOT NULL,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    consumption_area TEXT,
    procedure_no TEXT,
    reason_id INTEGER REFERENCES movement_reasons(id),
    reference_no TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','APPROVED','VOIDED')),
    created_by INTEGER NOT NULL REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    approved_at TEXT,
    voided_by INTEGER REFERENCES users(id),
    voided_at TEXT,
    void_reason TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS consumption_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consumption_id INTEGER NOT NULL REFERENCES consumptions(id),
    item_id INTEGER NOT NULL REFERENCES items(id),
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit_id INTEGER NOT NULL REFERENCES units(id),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movement_no TEXT NOT NULL COLLATE NOCASE UNIQUE,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('OPENING','RECEIPT','TRANSFER','ISSUE','CONSUMPTION','COUNT_ADJUSTMENT')),
    item_id INTEGER NOT NULL REFERENCES items(id),
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    direction TEXT NOT NULL CHECK (direction IN ('IN','OUT')),
    signed_quantity NUMERIC NOT NULL CHECK (signed_quantity <> 0),
    unit_id INTEGER NOT NULL REFERENCES units(id),
    source_warehouse_id INTEGER REFERENCES warehouses(id),
    destination_warehouse_id INTEGER REFERENCES warehouses(id),
    source_document_type TEXT NOT NULL,
    source_document_id INTEGER NOT NULL,
    source_line_id INTEGER,
    reason_id INTEGER REFERENCES movement_reasons(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    occurred_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    reversal_of_movement_id INTEGER REFERENCES stock_movements(id),
    CHECK ((direction = 'IN' AND signed_quantity > 0) OR (direction = 'OUT' AND signed_quantity < 0))
);
CREATE INDEX IF NOT EXISTS ix_stock_movements_item_warehouse ON stock_movements(item_id, warehouse_id, occurred_at);
CREATE INDEX IF NOT EXISTS ix_stock_movements_source ON stock_movements(source_document_type, source_document_id);

CREATE TABLE IF NOT EXISTS inventory_counts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    count_no TEXT NOT NULL COLLATE NOCASE UNIQUE,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    count_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','APPROVED','CANCELLED')),
    created_by INTEGER NOT NULL REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    approved_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS inventory_count_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    count_id INTEGER NOT NULL REFERENCES inventory_counts(id),
    item_id INTEGER NOT NULL REFERENCES items(id),
    book_quantity NUMERIC NOT NULL,
    physical_quantity NUMERIC NOT NULL CHECK (physical_quantity >= 0),
    difference_quantity NUMERIC NOT NULL,
    unit_id INTEGER NOT NULL REFERENCES units(id),
    adjustment_movement_id INTEGER REFERENCES stock_movements(id),
    notes TEXT,
    UNIQUE(count_id, item_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    before_json TEXT,
    after_json TEXT,
    reason TEXT,
    machine_name TEXT,
    application_version TEXT,
    occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS license_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_id TEXT NOT NULL UNIQUE,
    product_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    license_type TEXT NOT NULL,
    issue_date TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    version TEXT NOT NULL,
    license_payload_hash TEXT NOT NULL,
    status TEXT NOT NULL,
    activated_at TEXT,
    raw_license_path TEXT
);
CREATE TABLE IF NOT EXISTS license_local_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_seen_utc TEXT NOT NULL,
    last_seen_local_date TEXT NOT NULL,
    last_license_id TEXT,
    state_signature TEXT NOT NULL,
    clock_warning_status TEXT NOT NULL DEFAULT 'OK',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS backup_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backup_path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    application_version TEXT NOT NULL,
    schema_version INTEGER NOT NULL,
    file_size INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    verified_at TEXT,
    restored_at TEXT
);

INSERT OR IGNORE INTO schema_migrations(version) VALUES (1);
INSERT OR IGNORE INTO units(code, name_ar, name_en) VALUES
 ('PCS','قطعة','Piece'), ('BOX','علبة','Box'), ('AMP','أمبول','Ampoule'),
 ('VIAL','فيال','Vial'), ('BAG','كيس','Bag'), ('CARTON','كرتونة','Carton');
INSERT OR IGNORE INTO roles(code, name) VALUES
 ('ADMIN','مسؤول النظام'), ('STORE_MANAGER','مدير مخزن'), ('STORE_USER','مستخدم مخزن'), ('VIEWER','مشاهد');
INSERT OR IGNORE INTO warehouses(code, name, warehouse_type) VALUES
 ('MAIN','المخزن الرئيسي','MAIN'), ('ER','مخزن الطوارئ','EMERGENCY'),
 ('OR-MED','أدوية العمليات','OPERATING_ROOM_MEDICINE'), ('OR-SUP','مستلزمات العمليات','OPERATING_ROOM_SUPPLIES');
