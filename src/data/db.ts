// Database engine for SoliMedical-ERB
// Persists SQLite schema in LocalStorage and implements transaction-safe movements

export interface User {
  id: number;
  username: string;
  display_name: string;
  password_hash: string;
  role: 'ADMIN' | 'STORE_MANAGER' | 'STORE_USER' | 'VIEWER';
  is_active: boolean;
  allowed_warehouses: number[]; // empty means all warehouses (or ADMIN)
  last_login_at?: string;
  created_at: string;
}

export interface Warehouse {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

export interface Category {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
}

export interface Unit {
  id: number;
  code: string;
  name_ar: string;
  is_active: boolean;
}

export interface Item {
  id: number;
  sku: string;
  name_ar: string;
  category_id: number;
  base_unit_id: number;
  minimum_stock: number;
  expiry_tracking: boolean;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentLine {
  id: number;
  item_id: number;
  quantity: number;
  unit_id: number;
  unit_cost?: number;
  batch_no?: string;
  expiry_date?: string;
  notes?: string;
}

export interface Document {
  id: number;
  document_no: string;
  document_date: string;
  document_type: 'RECEIPT' | 'TRANSFER' | 'ISSUE' | 'CONSUMPTION';
  status: 'DRAFT' | 'APPROVED' | 'VOIDED';
  created_by: string;
  approved_by?: string;
  approved_at?: string;
  voided_by?: string;
  voided_at?: string;
  void_reason?: string;
  notes?: string;
  // Specific to Receipts
  supplier_id?: number;
  destination_warehouse_id?: number;
  receipt_type?: string;
  // Specific to Transfers
  source_warehouse_id?: number;
  // Specific to Issues & Consumptions
  warehouse_id?: number;
  issued_to?: string;
  department?: string;
  consumption_area?: string;
  procedure_no?: string;
  
  lines: DocumentLine[];
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: number;
  movement_no: string;
  movement_type: 'OPENING' | 'RECEIPT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ISSUE' | 'CONSUMPTION' | 'COUNT_ADJUSTMENT_IN' | 'COUNT_ADJUSTMENT_OUT';
  item_id: number;
  warehouse_id: number;
  quantity: number;
  direction: 'IN' | 'OUT';
  signed_quantity: number; // positive for IN, negative for OUT
  unit_id: number;
  source_warehouse_id?: number;
  destination_warehouse_id?: number;
  source_document_type?: 'RECEIPT' | 'TRANSFER' | 'ISSUE' | 'CONSUMPTION' | 'COUNT';
  source_document_id?: number;
  source_line_id?: number;
  user_id: number;
  occurred_at: string;
  created_at: string;
  notes?: string;
}

export interface InventoryCountLine {
  id: number;
  item_id: number;
  book_quantity: number;
  physical_quantity: number;
  difference_quantity: number;
  unit_id: number;
  notes?: string;
}

export interface InventoryCount {
  id: number;
  count_no: string;
  warehouse_id: number;
  count_date: string;
  status: 'DRAFT' | 'APPROVED' | 'CANCELLED';
  created_by: string;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
  lines: InventoryCountLine[];
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  user_id: number;
  username: string;
  action: string;
  entity_type: string;
  entity_id: number;
  before_json?: string;
  after_json?: string;
  reason?: string;
  occurred_at: string;
}

export interface LicenseRecord {
  id: number;
  license_id: string;
  customer_id: string;
  license_type: 'TRIAL' | 'COMMERCIAL' | 'UNLIMITED';
  issue_date: string;
  expiry_date: string;
  raw_payload: string;
  status: 'ACTIVE' | 'EXPIRED' | 'INVALID';
  activated_at: string;
}

export interface LocalLicenseState {
  last_seen_utc: string;
  last_seen_local_date: string;
  last_license_id: string;
  clock_warning_status: boolean;
  updated_at: string;
}

export interface Supplier {
  id: number;
  code: string;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  is_active: boolean;
}

// Global Database Schema Structure
export interface DBSchema {
  users: User[];
  warehouses: Warehouse[];
  categories: Category[];
  units: Unit[];
  items: Item[];
  documents: Document[];
  movements: StockMovement[];
  counts: InventoryCount[];
  audit_logs: AuditLog[];
  license_records: LicenseRecord[];
  license_state: LocalLicenseState;
  suppliers: Supplier[];
}

const STORAGE_KEY = 'solimedical_erb_db';

// Initial Seeds
const initialWarehouses: Warehouse[] = [
  { id: 1, code: 'MAIN', name: 'المخزن الرئيسي للمجمع', is_active: true, notes: 'المخزن المركزي الرئيسي لتلقي وتوزيع الأدوية والمستلزمات', created_at: new Date().toISOString() },
  { id: 2, code: 'EMER', name: 'مخزن الطوارئ والاستقبال', is_active: true, notes: 'مخزن فرعي مخصص لقسم الطوارئ والحالات العاجلة', created_at: new Date().toISOString() },
  { id: 3, code: 'ORDR', name: 'مخزن أدوية العمليات الجراحية', is_active: true, notes: 'مخزن مخصص داخل غرف العمليات للأدوية والمخدر والغازات الطبية', created_at: new Date().toISOString() },
  { id: 4, code: 'ORSU', name: 'مخزن مستلزمات العمليات', is_active: true, notes: 'مخزن مخصص للمستلزمات الجراحية المعقمة، الخيوط، والشبكات وغيرها', created_at: new Date().toISOString() },
];

const initialCategories: Category[] = [
  { id: 1, code: 'DRUG', name: 'الأدوية والمحاليل الطبية', is_active: true },
  { id: 2, code: 'SUPP', name: 'المستلزمات الطبية العامة', is_active: true },
  { id: 3, code: 'SUTU', name: 'الخيوط والمستهلكات الجراحية', is_active: true },
  { id: 4, code: 'EQUP', name: 'الأجهزة الطبية ومعداتها المعقمة', is_active: true },
];

const initialUnits: Unit[] = [
  { id: 1, code: 'PCS', name_ar: 'قطعة', is_active: true },
  { id: 2, code: 'BOX', name_ar: 'علبة', is_active: true },
  { id: 3, code: 'AMP', name_ar: 'أمبول', is_active: true },
  { id: 4, code: 'VIAL', name_ar: 'فيال (زجاجة حقن)', is_active: true },
  { id: 5, code: 'BAG', name_ar: 'كيس محلول', is_active: true },
];

const initialSuppliers: Supplier[] = [
  { id: 1, code: 'SUPP01', name: 'الشركة المصرية الدولية للأدوية (إيبيكو)', phone: '02-33445566', address: 'مدينة العاشر من رمضان، مصر', is_active: true },
  { id: 2, code: 'SUPP02', name: 'مستودع المتحدة للصناعات الطبية', phone: '02-44556677', address: 'مصر الجديدة، القاهرة', is_active: true },
  { id: 3, code: 'SUPP03', name: 'مؤسسة الشفاء لتوريد الخيوط والآلات الجراحية', phone: '03-55667788', address: 'سموحة، الإسكندرية', is_active: true }
];

const initialItems: Item[] = [
  { id: 1, sku: 'MED-001', name_ar: 'بنادول 500 ملجم (أقراص)', category_id: 1, base_unit_id: 2, minimum_stock: 50, expiry_tracking: true, is_active: true, notes: 'مسكن وخافض حرارة شائع الاستخدام', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 2, sku: 'SOL-001', name_ar: 'محلول ملح طعام 0.9% 500 مل', category_id: 1, base_unit_id: 5, minimum_stock: 100, expiry_tracking: true, is_active: true, notes: 'محلول كلوريد الصوديوم المعقم للحقن والوريد', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 3, sku: 'DISP-001', name_ar: 'سرنجات معقمة استخدام مرة واحدة 5 مل', category_id: 2, base_unit_id: 1, minimum_stock: 200, expiry_tracking: false, is_active: true, notes: 'حقن بلاستيكية معقمة للاستخدام الفردي مع إبرة مدمجة', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 4, sku: 'DISP-002', name_ar: 'قفازات فحص معقمة مقاس 7.5 خالية من البودرة', category_id: 2, base_unit_id: 2, minimum_stock: 150, expiry_tracking: false, is_active: true, notes: 'قفازات طبية معقمة للجراحة والفحص', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 5, sku: 'DISP-003', name_ar: 'كانيولا وريدية زرقاء مقاس 22G صمام حقن', category_id: 2, base_unit_id: 1, minimum_stock: 80, expiry_tracking: true, is_active: true, notes: 'كانيولا إعطاء المحاليل وسحب الدم للأطفال والبالغين', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 6, sku: 'SURG-001', name_ar: 'خيوط جراحية حرير كحلي مقاس 3-0 نيدل دائري 20 مم', category_id: 3, base_unit_id: 1, minimum_stock: 40, expiry_tracking: true, is_active: true, notes: 'خيوط جراحية غير ممتصة لإغلاق الأنسجة السطحية', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 7, sku: 'MED-002', name_ar: 'باراسيتامول أمبول 10 ملجم/مل 100 مل للوريد', category_id: 1, base_unit_id: 1, minimum_stock: 120, expiry_tracking: true, is_active: true, notes: 'مسكن آلام سريع المفعول للتنقيط الوريدي', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 8, sku: 'SURG-002', name_ar: 'شاش طبي جراحي معقم 10*10 سم عبوة فردية', category_id: 3, base_unit_id: 1, minimum_stock: 300, expiry_tracking: false, is_active: true, notes: 'ضمادات شاش قطنية عالية الامتصاص معقمة للأشعة', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 9, sku: 'SURG-003', name_ar: 'لاصق جراحي مضاد للماء مقاس 10 سم * 10 م', category_id: 3, base_unit_id: 1, minimum_stock: 60, expiry_tracking: false, is_active: true, notes: 'بكرة لاصق جراحي لتثبيت الضمادات الكبيرة ومقاوم للرطوبة', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 10, sku: 'DISP-004', name_ar: 'كمامات طبية 3 طبقات باستك حلقي', category_id: 2, base_unit_id: 2, minimum_stock: 500, expiry_tracking: false, is_active: true, notes: 'علبة بها 50 كمامة واقية ذات كفاءة فلترة عالية', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
];

// We will seed initial stock movements as "OPENING" to give items initial stock quantities in different warehouses
const initialMovements: StockMovement[] = [
  // MAIN WAREHOUSE (id: 1) Initial opening balances
  { id: 1, movement_no: 'M-001', movement_type: 'OPENING', item_id: 1, warehouse_id: 1, quantity: 150, direction: 'IN', signed_quantity: 150, unit_id: 2, user_id: 1, occurred_at: '2026-09-01T08:00:00Z', created_at: '2026-09-01T08:00:00Z', notes: 'رصيد افتتاحي تأسيسي عند إطلاق النظام' },
  { id: 2, movement_no: 'M-002', movement_type: 'OPENING', item_id: 2, warehouse_id: 1, quantity: 500, direction: 'IN', signed_quantity: 500, unit_id: 5, user_id: 1, occurred_at: '2026-09-01T08:05:00Z', created_at: '2026-09-01T08:05:00Z', notes: 'رصيد افتتاحي تأسيسي عند إطلاق النظام' },
  { id: 3, movement_no: 'M-003', movement_type: 'OPENING', item_id: 3, warehouse_id: 1, quantity: 1000, direction: 'IN', signed_quantity: 1000, unit_id: 1, user_id: 1, occurred_at: '2026-09-01T08:10:00Z', created_at: '2026-09-01T08:10:00Z', notes: 'رصيد افتتاحي تأسيسي عند إطلاق النظام' },
  { id: 4, movement_no: 'M-004', movement_type: 'OPENING', item_id: 4, warehouse_id: 1, quantity: 300, direction: 'IN', signed_quantity: 300, unit_id: 2, user_id: 1, occurred_at: '2026-09-01T08:15:00Z', created_at: '2026-09-01T08:15:00Z', notes: 'رصيد افتتاحي تأسيسي عند إطلاق النظام' },
  { id: 5, movement_no: 'M-005', movement_type: 'OPENING', item_id: 5, warehouse_id: 1, quantity: 200, direction: 'IN', signed_quantity: 200, unit_id: 1, user_id: 1, occurred_at: '2026-09-01T08:20:00Z', created_at: '2026-09-01T08:20:00Z', notes: 'رصيد افتتاحي تأسيسي عند إطلاق النظام' },
  
  // EMERGENCY WAREHOUSE (id: 2) Initial opening balances
  { id: 6, movement_no: 'M-006', movement_type: 'OPENING', item_id: 1, warehouse_id: 2, quantity: 20, direction: 'IN', signed_quantity: 20, unit_id: 2, user_id: 1, occurred_at: '2026-09-01T09:00:00Z', created_at: '2026-09-01T09:00:00Z', notes: 'أرصدة الطوارئ الأساسية المستوردة' },
  { id: 7, movement_no: 'M-007', movement_type: 'OPENING', item_id: 2, warehouse_id: 2, quantity: 80, direction: 'IN', signed_quantity: 80, unit_id: 5, user_id: 1, occurred_at: '2026-09-01T09:05:00Z', created_at: '2026-09-01T09:05:00Z', notes: 'أرصدة الطوارئ الأساسية المستوردة' },
  { id: 8, movement_no: 'M-008', movement_type: 'OPENING', item_id: 5, warehouse_id: 2, quantity: 30, direction: 'IN', signed_quantity: 30, unit_id: 1, user_id: 1, occurred_at: '2026-09-01T09:10:00Z', created_at: '2026-09-01T09:10:00Z', notes: 'أرصدة الطوارئ الأساسية المستوردة' },

  // OR DRUGS WAREHOUSE (id: 3) Initial opening balances
  { id: 9, movement_no: 'M-009', movement_type: 'OPENING', item_id: 7, warehouse_id: 3, quantity: 150, direction: 'IN', signed_quantity: 150, unit_id: 1, user_id: 1, occurred_at: '2026-09-01T09:15:00Z', created_at: '2026-09-01T09:15:00Z', notes: 'افتتاح مخزن أدوية العمليات' },

  // OR SUPPLIES WAREHOUSE (id: 4) Initial opening balances
  { id: 10, movement_no: 'M-010', movement_type: 'OPENING', item_id: 6, warehouse_id: 4, quantity: 80, direction: 'IN', signed_quantity: 80, unit_id: 1, user_id: 1, occurred_at: '2026-09-01T09:20:00Z', created_at: '2026-09-01T09:20:00Z', notes: 'افتتاح مخزن مستلزمات العمليات' },
  { id: 11, movement_no: 'M-011', movement_type: 'OPENING', item_id: 8, warehouse_id: 4, quantity: 500, direction: 'IN', signed_quantity: 500, unit_id: 1, user_id: 1, occurred_at: '2026-09-01T09:25:00Z', created_at: '2026-09-01T09:25:00Z', notes: 'افتتاح مخزن مستلزمات العمليات' },
  { id: 12, movement_no: 'M-012', movement_type: 'OPENING', item_id: 9, warehouse_id: 4, quantity: 100, direction: 'IN', signed_quantity: 100, unit_id: 1, user_id: 1, occurred_at: '2026-09-01T09:30:00Z', created_at: '2026-09-01T09:30:00Z', notes: 'افتتاح مخزن مستلزمات العمليات' }
];

const initialUsers: User[] = [
  {
    id: 1,
    username: 'admin',
    display_name: 'د. أحمد سليمان (المدير)',
    password_hash: '202cb962ac59075b964b07152d234b70', // "123" MD5 hash or similar, let's use direct match strings for simplicity in the dashboard
    role: 'ADMIN',
    is_active: true,
    allowed_warehouses: [], // ADMIN allowed on all
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    username: 'manager',
    display_name: 'أ. محمد عبد الله (مدير المخازن)',
    password_hash: '202cb962ac59075b964b07152d234b70', // "123"
    role: 'STORE_MANAGER',
    is_active: true,
    allowed_warehouses: [1, 2, 3, 4],
    created_at: new Date().toISOString(),
  },
  {
    id: 3,
    username: 'user_main',
    display_name: 'أ. ياسر محمد (أمين المخزن الرئيسي)',
    password_hash: '202cb962ac59075b964b07152d234b70', // "123"
    role: 'STORE_USER',
    is_active: true,
    allowed_warehouses: [1],
    created_at: new Date().toISOString(),
  },
  {
    id: 4,
    username: 'user_emer',
    display_name: 'أ. دعاء حسين (أمينة مخزن الطوارئ)',
    password_hash: '202cb962ac59075b964b07152d234b70', // "123"
    role: 'STORE_USER',
    is_active: true,
    allowed_warehouses: [2],
    created_at: new Date().toISOString(),
  },
  {
    id: 5,
    username: 'viewer',
    display_name: 'د. رانيا علي (مراقب الجودة والحسابات)',
    password_hash: '202cb962ac59075b964b07152d234b70', // "123"
    role: 'VIEWER',
    is_active: true,
    allowed_warehouses: [], // Viewer can view all
    created_at: new Date().toISOString(),
  }
];

const defaultLicenseState: LocalLicenseState = {
  last_seen_utc: new Date().toISOString(),
  last_seen_local_date: new Date().toLocaleDateString('en-US'),
  last_license_id: 'SOLI-TRIAL-8572',
  clock_warning_status: false,
  updated_at: new Date().toISOString()
};

const defaultLicenseRecord: LicenseRecord = {
  id: 1,
  license_id: 'SOLI-TRIAL-8572',
  customer_id: 'ahmed0soliman6@gmail.com',
  license_type: 'TRIAL',
  issue_date: '2026-09-01',
  expiry_date: '2027-09-01', // Valid for a year in the future
  raw_payload: 'SIGNED_PAYLOAD_TRIAL',
  status: 'ACTIVE',
  activated_at: '2026-09-01T08:00:00Z'
};

import { hospitalCategories, hospitalUnits, generateHospitalInventory } from './hospitalData';

export const DB_VERSION = 2;

export function getInitialDB(): DBSchema {
  const seed = generateHospitalInventory();
  return {
    users: initialUsers,
    warehouses: initialWarehouses,
    categories: hospitalCategories,
    units: hospitalUnits,
    items: seed.items,
    documents: [],
    movements: seed.movements,
    counts: [],
    audit_logs: [
      { id: 1, user_id: 1, username: 'admin', action: 'تأسيس النظام', entity_type: 'قاعدة البيانات', entity_id: 0, occurred_at: new Date().toISOString() }
    ],
    license_records: [defaultLicenseRecord],
    license_state: defaultLicenseState,
    suppliers: initialSuppliers
  };
}

export function upgradeHospitalInventory(db: DBSchema): DBSchema {
  const seed = generateHospitalInventory();
  
  // Merge categories
  hospitalCategories.forEach(cat => {
    if (!db.categories.some(c => c.id === cat.id)) {
      db.categories.push(cat);
    }
  });

  // Merge units
  hospitalUnits.forEach(u => {
    if (!db.units.some(existingU => existingU.id === u.id)) {
      db.units.push(u);
    }
  });

  // If db has only the old placeholder items (< 50 items), replace with full hospital inventory
  if (!db.items || db.items.length < 50) {
    db.items = seed.items;
    db.movements = seed.movements;
  } else {
    // Merge any missing items from seed
    let nextId = Math.max(...db.items.map(it => it.id), 0) + 1;
    let nextMovId = Math.max(...db.movements.map(m => m.id), 0) + 1;
    
    seed.items.forEach(newItem => {
      if (!db.items.some(it => it.name_ar.trim() === newItem.name_ar.trim())) {
        const assignedId = nextId++;
        const itemCopy = { ...newItem, id: assignedId };
        db.items.push(itemCopy);
        
        const originalMov = seed.movements.find(m => m.item_id === newItem.id);
        if (originalMov) {
          db.movements.push({
            ...originalMov,
            id: nextMovId++,
            item_id: assignedId
          });
        }
      }
    });
  }

  (db as any).data_version = DB_VERSION;
  return db;
}

export function resetToHospitalCatalog(): DBSchema {
  const fresh = getInitialDB();
  (fresh as any).data_version = DB_VERSION;
  saveDB(fresh);
  return fresh;
}

export function loadDB(): DBSchema {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    const fresh = getInitialDB();
    (fresh as any).data_version = DB_VERSION;
    saveDB(fresh);
    return fresh;
  }
  try {
    let parsed: DBSchema & { data_version?: number } = JSON.parse(data);
    if (!parsed.data_version || parsed.data_version < DB_VERSION || parsed.items.length < 50) {
      parsed = upgradeHospitalInventory(parsed);
      saveDB(parsed);
    }
    return parsed;
  } catch {
    const fresh = getInitialDB();
    (fresh as any).data_version = DB_VERSION;
    saveDB(fresh);
    return fresh;
  }
}

export function saveDB(db: DBSchema): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

// Transaction processing for Document Approvals
// This implements negative stock prevention and creates atomic entries in stock_movements
export function approveDocument(docId: number, userId: number, userName: string): { success: boolean; error?: string } {
  const db = loadDB();
  const docIdx = db.documents.findIndex(d => d.id === docId);
  if (docIdx === -1) return { success: false, error: 'المستند غير موجود' };
  
  const doc = db.documents[docIdx];
  if (doc.status !== 'DRAFT') return { success: false, error: 'المستند ليس في حالة مسودة' };

  // 1. Core Rule Validation: Prevent negative stocks
  // Compute balances from current movements
  const calculateStock = (itemId: number, warehouseId: number) => {
    return db.movements
      .filter(m => m.item_id === itemId && m.warehouse_id === warehouseId)
      .reduce((sum, m) => sum + m.signed_quantity, 0);
  };

  const newMovements: StockMovement[] = [];
  let currentMovId = db.movements.length > 0 ? Math.max(...db.movements.map(m => m.id)) + 1 : 1;

  // Track simulated stock values within this "Transaction" to avoid race conditions in the same document
  const simulatedStocks: Record<string, number> = {};

  const getSimulatedStock = (itemId: number, warehouseId: number) => {
    const key = `${itemId}-${warehouseId}`;
    if (simulatedStocks[key] === undefined) {
      simulatedStocks[key] = calculateStock(itemId, warehouseId);
    }
    return simulatedStocks[key];
  };

  const deductSimulatedStock = (itemId: number, warehouseId: number, qty: number) => {
    const key = `${itemId}-${warehouseId}`;
    simulatedStocks[key] = getSimulatedStock(itemId, warehouseId) - qty;
  };

  const addSimulatedStock = (itemId: number, warehouseId: number, qty: number) => {
    const key = `${itemId}-${warehouseId}`;
    simulatedStocks[key] = getSimulatedStock(itemId, warehouseId) + qty;
  };

  // Perform validations and prepare movements
  for (let i = 0; i < doc.lines.length; i++) {
    const line = doc.lines[i];
    const item = db.items.find(it => it.id === line.item_id);
    if (!item) return { success: false, error: `الصنف غير معروف في السطر ${i + 1}` };

    if (doc.document_type === 'RECEIPT') {
      // Inward movement
      const destId = doc.destination_warehouse_id!;
      newMovements.push({
        id: currentMovId++,
        movement_no: `MOV-R-${Date.now().toString().slice(-6)}-${currentMovId}`,
        movement_type: 'RECEIPT',
        item_id: line.item_id,
        warehouse_id: destId,
        quantity: line.quantity,
        direction: 'IN',
        signed_quantity: line.quantity,
        unit_id: line.unit_id,
        source_document_type: 'RECEIPT',
        source_document_id: doc.id,
        source_line_id: line.id,
        user_id: userId,
        occurred_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        notes: `توريد مستند رقم ${doc.document_no} - المورد: ${db.suppliers.find(s => s.id === doc.supplier_id)?.name || 'غير معروف'}`
      });
    } 
    
    else if (doc.document_type === 'TRANSFER') {
      const srcId = doc.source_warehouse_id!;
      const destId = doc.destination_warehouse_id!;
      
      if (srcId === destId) {
        return { success: false, error: 'المخزن المصدر والمخزن الوجهة متطابقان!' };
      }

      // Check current available stock
      const available = getSimulatedStock(line.item_id, srcId);
      if (available < line.quantity) {
        return { 
          success: false, 
          error: `الرصيد غير كافٍ للصنف "${item.name_ar}" في مخزن المصدر. المتاح: ${available}، المطلوب: ${line.quantity}` 
        };
      }

      deductSimulatedStock(line.item_id, srcId, line.quantity);
      addSimulatedStock(line.item_id, destId, line.quantity);

      // Create OUT movement for source
      newMovements.push({
        id: currentMovId++,
        movement_no: `MOV-T-OUT-${Date.now().toString().slice(-6)}-${currentMovId}`,
        movement_type: 'TRANSFER_OUT',
        item_id: line.item_id,
        warehouse_id: srcId,
        quantity: line.quantity,
        direction: 'OUT',
        signed_quantity: -line.quantity,
        unit_id: line.unit_id,
        source_warehouse_id: srcId,
        destination_warehouse_id: destId,
        source_document_type: 'TRANSFER',
        source_document_id: doc.id,
        source_line_id: line.id,
        user_id: userId,
        occurred_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        notes: `تحويل (خروج) بموجب مستند رقم ${doc.document_no}`
      });

      // Create IN movement for destination
      newMovements.push({
        id: currentMovId++,
        movement_no: `MOV-T-IN-${Date.now().toString().slice(-6)}-${currentMovId}`,
        movement_type: 'TRANSFER_IN',
        item_id: line.item_id,
        warehouse_id: destId,
        quantity: line.quantity,
        direction: 'IN',
        signed_quantity: line.quantity,
        unit_id: line.unit_id,
        source_warehouse_id: srcId,
        destination_warehouse_id: destId,
        source_document_type: 'TRANSFER',
        source_document_id: doc.id,
        source_line_id: line.id,
        user_id: userId,
        occurred_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        notes: `تحويل (دخول) بموجب مستند رقم ${doc.document_no}`
      });
    } 
    
    else if (doc.document_type === 'ISSUE') {
      const srcId = doc.warehouse_id!;
      const available = getSimulatedStock(line.item_id, srcId);
      if (available < line.quantity) {
        return { 
          success: false, 
          error: `الرصيد غير كافٍ للصنف "${item.name_ar}". المتاح: ${available}، المطلوب: ${line.quantity}` 
        };
      }

      deductSimulatedStock(line.item_id, srcId, line.quantity);

      newMovements.push({
        id: currentMovId++,
        movement_no: `MOV-I-${Date.now().toString().slice(-6)}-${currentMovId}`,
        movement_type: 'ISSUE',
        item_id: line.item_id,
        warehouse_id: srcId,
        quantity: line.quantity,
        direction: 'OUT',
        signed_quantity: -line.quantity,
        unit_id: line.unit_id,
        source_document_type: 'ISSUE',
        source_document_id: doc.id,
        source_line_id: line.id,
        user_id: userId,
        occurred_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        notes: `صرف لقسم: ${doc.department || 'غير محدد'} - المستلم: ${doc.issued_to || 'غير محدد'} بموجب مستند رقم ${doc.document_no}`
      });
    } 
    
    else if (doc.document_type === 'CONSUMPTION') {
      const srcId = doc.warehouse_id!;
      const available = getSimulatedStock(line.item_id, srcId);
      if (available < line.quantity) {
        return { 
          success: false, 
          error: `الرصيد غير كافٍ للصنف "${item.name_ar}". المتاح: ${available}، المطلوب: ${line.quantity}` 
        };
      }

      deductSimulatedStock(line.item_id, srcId, line.quantity);

      newMovements.push({
        id: currentMovId++,
        movement_no: `MOV-C-${Date.now().toString().slice(-6)}-${currentMovId}`,
        movement_type: 'CONSUMPTION',
        item_id: line.item_id,
        warehouse_id: srcId,
        quantity: line.quantity,
        direction: 'OUT',
        signed_quantity: -line.quantity,
        unit_id: line.unit_id,
        source_document_type: 'CONSUMPTION',
        source_document_id: doc.id,
        source_line_id: line.id,
        user_id: userId,
        occurred_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        notes: `استهلاك في عيادة/منطقة: ${doc.consumption_area || 'غير محدد'} بموجب مستند رقم ${doc.document_no}`
      });
    }
  }

  // All checks passed! Execute database atomic transaction
  doc.status = 'APPROVED';
  doc.approved_by = userName;
  doc.approved_at = new Date().toISOString();
  doc.updated_at = new Date().toISOString();

  db.movements.push(...newMovements);
  
  // Write to Audit Log
  const auditId = db.audit_logs.length > 0 ? Math.max(...db.audit_logs.map(a => a.id)) + 1 : 1;
  db.audit_logs.push({
    id: auditId,
    user_id: userId,
    username: userName,
    action: 'اعتماد مستند',
    entity_type: doc.document_type === 'RECEIPT' ? 'توريد' : doc.document_type === 'TRANSFER' ? 'تحويل' : doc.document_type === 'ISSUE' ? 'صرف' : 'استهلاك',
    entity_id: doc.id,
    after_json: JSON.stringify({ document_no: doc.document_no, lines_count: doc.lines.length }),
    occurred_at: new Date().toISOString()
  });

  saveDB(db);
  return { success: true };
}

// Void Document Function (for APPROVED documents, must create reversals in movements ledger)
export function voidDocument(docId: number, userId: number, userName: string, reason: string): { success: boolean; error?: string } {
  const db = loadDB();
  const docIdx = db.documents.findIndex(d => d.id === docId);
  if (docIdx === -1) return { success: false, error: 'المستند غير موجود' };
  
  const doc = db.documents[docIdx];
  if (doc.status !== 'APPROVED') return { success: false, error: 'لا يمكن إبطال مستند غير معتمد' };

  // Calculate stock levels before reversing to verify we don't end up with a negative stock
  const calculateStock = (itemId: number, warehouseId: number) => {
    return db.movements
      .filter(m => m.item_id === itemId && m.warehouse_id === warehouseId)
      .reduce((sum, m) => sum + m.signed_quantity, 0);
  };

  const getDocTypeAr = (type: string) => {
    switch (type) {
      case 'RECEIPT': return 'توريد';
      case 'TRANSFER': return 'تحويل';
      case 'ISSUE': return 'صرف';
      case 'CONSUMPTION': return 'استهلاك';
      default: return 'مستند';
    }
  };

  // Find all movements generated by this document
  const assocMovements = db.movements.filter(m => m.source_document_id === docId && m.source_document_type === doc.document_type);
  
  // Validate that reversing won't trigger negative stocks
  const simulatedStocks: Record<string, number> = {};
  for (const m of assocMovements) {
    const key = `${m.item_id}-${m.warehouse_id}`;
    if (simulatedStocks[key] === undefined) {
      simulatedStocks[key] = calculateStock(m.item_id, m.warehouse_id);
    }
    
    // We are reversing the movement.
    // If movement was IN (signed_quantity positive), reversal will be OUT (subtraction)
    // If movement was OUT (signed_quantity negative), reversal will be IN (addition)
    const reversedSignedQty = -m.signed_quantity;
    if (simulatedStocks[key] + reversedSignedQty < 0) {
      const item = db.items.find(it => it.id === m.item_id);
      return { 
        success: false, 
        error: `لا يمكن إبطال المستند لأن ذلك سيتسبب في رصيد سالب للصنف "${item?.name_ar || m.item_id}" بالمستودع. الرصيد الحالي: ${simulatedStocks[key]}، المطلوب خصمه: ${m.quantity}` 
      };
    }
    simulatedStocks[key] += reversedSignedQty;
  }

  // Verification passed! Create reversal movements
  const reversalMovements: StockMovement[] = [];
  let currentMovId = db.movements.length > 0 ? Math.max(...db.movements.map(m => m.id)) + 1 : 1;

  for (const m of assocMovements) {
    reversalMovements.push({
      id: currentMovId++,
      movement_no: `MOV-REV-${Date.now().toString().slice(-6)}-${currentMovId}`,
      movement_type: m.direction === 'IN' ? 'COUNT_ADJUSTMENT_OUT' : 'COUNT_ADJUSTMENT_IN', // Treat reversal as adjustment
      item_id: m.item_id,
      warehouse_id: m.warehouse_id,
      quantity: m.quantity,
      direction: m.direction === 'IN' ? 'OUT' : 'IN',
      signed_quantity: -m.signed_quantity,
      unit_id: m.unit_id,
      source_document_type: doc.document_type,
      source_document_id: doc.id,
      user_id: userId,
      occurred_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      notes: `حركة عكسية لإبطال مستند ${getDocTypeAr(doc.document_type)} رقم ${doc.document_no} - السبب: ${reason}`
    });
  }

  doc.status = 'VOIDED';
  doc.voided_by = userName;
  doc.voided_at = new Date().toISOString();
  doc.void_reason = reason;
  doc.updated_at = new Date().toISOString();

  db.movements.push(...reversalMovements);

  // Write to Audit Log
  const auditId = db.audit_logs.length > 0 ? Math.max(...db.audit_logs.map(a => a.id)) + 1 : 1;
  db.audit_logs.push({
    id: auditId,
    user_id: userId,
    username: userName,
    action: 'إبطال مستند معتمد',
    entity_type: getDocTypeAr(doc.document_type),
    entity_id: doc.id,
    reason: reason,
    occurred_at: new Date().toISOString()
  });

  saveDB(db);
  return { success: true };
}

// Approve Inventory Counting Document
export function approveInventoryCount(countId: number, userId: number, userName: string): { success: boolean; error?: string } {
  const db = loadDB();
  const countIdx = db.counts.findIndex(c => c.id === countId);
  if (countIdx === -1) return { success: false, error: 'جلسة الجرد غير موجودة' };

  const count = db.counts[countIdx];
  if (count.status !== 'DRAFT') return { success: false, error: 'جلسة الجرد ليست في حالة مسودة' };

  // Calculate real-time book stock to verify physical difference
  const calculateStock = (itemId: number, warehouseId: number) => {
    return db.movements
      .filter(m => m.item_id === itemId && m.warehouse_id === warehouseId)
      .reduce((sum, m) => sum + m.signed_quantity, 0);
  };

  const newMovements: StockMovement[] = [];
  let currentMovId = db.movements.length > 0 ? Math.max(...db.movements.map(m => m.id)) + 1 : 1;

  for (const line of count.lines) {
    const liveBookQty = calculateStock(line.item_id, count.warehouse_id);
    
    // In case book stock changed since the session was created, we adjust based on live stock or freeze difference.
    // The design document says: "difference = physical - book quantity. The difference is posted as adjustment."
    // Let's use the difference computed at approval:
    const diff = line.physical_quantity - liveBookQty;
    
    if (diff === 0) continue; // No difference, no movement needed

    // If diff is negative, we need OUT adjustment (shortage)
    // If diff is positive, we need IN adjustment (surplus)
    newMovements.push({
      id: currentMovId++,
      movement_no: `MOV-ADJ-${Date.now().toString().slice(-6)}-${currentMovId}`,
      movement_type: diff > 0 ? 'COUNT_ADJUSTMENT_IN' : 'COUNT_ADJUSTMENT_OUT',
      item_id: line.item_id,
      warehouse_id: count.warehouse_id,
      quantity: Math.abs(diff),
      direction: diff > 0 ? 'IN' : 'OUT',
      signed_quantity: diff,
      unit_id: line.unit_id,
      source_document_type: 'COUNT',
      source_document_id: count.id,
      user_id: userId,
      occurred_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      notes: `تسوية جردية عجز/زيادة بموجب محضر جرد رقم ${count.count_no} - الملاحظات: ${line.notes || ''}`
    });
  }

  count.status = 'APPROVED';
  count.approved_by = userName;
  count.approved_at = new Date().toISOString();
  count.updated_at = new Date().toISOString();

  if (newMovements.length > 0) {
    db.movements.push(...newMovements);
  }

  // Write to Audit Log
  const auditId = db.audit_logs.length > 0 ? Math.max(...db.audit_logs.map(a => a.id)) + 1 : 1;
  db.audit_logs.push({
    id: auditId,
    user_id: userId,
    username: userName,
    action: 'اعتماد جرد وتسوية',
    entity_type: 'جرد مستودع',
    entity_id: count.id,
    occurred_at: new Date().toISOString()
  });

  saveDB(db);
  return { success: true };
}

import { verifySignedLicense, generateSignedLicense, SignedLicensePayload } from '../utils/cryptoLicense';

export { verifySignedLicense, generateSignedLicense };
export type { SignedLicensePayload };

export function verifyLicenseKey(licenseKey: string): { isValid: boolean; payload?: any; error?: string } {
  const result = verifySignedLicense(licenseKey);
  if (!result.isValid || !result.payload) {
    return { isValid: false, error: result.error || 'رمز الترخيص غير صالح' };
  }
  return {
    isValid: true,
    payload: {
      license_id: result.payload.licenseId,
      customer_id: result.payload.customerId,
      license_type: result.payload.licenseType,
      issue_date: result.payload.issueDate,
      expiry_date: result.payload.expiryDate,
      raw_payload: licenseKey
    }
  };
}
