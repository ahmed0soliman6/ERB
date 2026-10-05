import { Item, StockMovement, Category, Unit, Warehouse } from './db';

export const hospitalCategories: Category[] = [
  { id: 1, code: 'DRUG', name: 'الأدوية والمحاليل الطبية', is_active: true },
  { id: 2, code: 'SUPP', name: 'المستلزمات الطبية العامة والمستهلكات', is_active: true },
  { id: 3, code: 'SUTU', name: 'الخيوط والأدوات الجراحية والقساطر', is_active: true },
  { id: 4, code: 'EQUP', name: 'الأجهزة والآلات الطبية', is_active: true },
  { id: 5, code: 'EMER', name: 'أدوية ومستلزمات الطوارئ', is_active: true },
  { id: 6, code: 'ORTH', name: 'الجبس والأربطة ومستلزمات التثبيت', is_active: true },
];

export const hospitalUnits: Unit[] = [
  { id: 1, code: 'PCS', name_ar: 'قطعة', is_active: true },
  { id: 2, code: 'BOX', name_ar: 'علبة', is_active: true },
  { id: 3, code: 'AMP', name_ar: 'أمبول', is_active: true },
  { id: 4, code: 'VIAL', name_ar: 'فيال (زجاجة حقن)', is_active: true },
  { id: 5, code: 'BAG', name_ar: 'كيس محلول', is_active: true },
  { id: 6, code: 'ROLL', name_ar: 'بكرة / رول', is_active: true },
  { id: 7, code: 'TUBE', name_ar: 'أنبوبة / كريم', is_active: true },
  { id: 8, code: 'STRIP', name_ar: 'شريط', is_active: true },
  { id: 9, code: 'CTN', name_ar: 'كرتونة', is_active: true },
];

export interface HospitalSeedData {
  items: Item[];
  movements: StockMovement[];
}

export function generateHospitalInventory(): HospitalSeedData {
  const items: Item[] = [];
  const movements: StockMovement[] = [];
  let nextItemId = 1;
  let nextMovId = 1;
  const now = new Date().toISOString();

  // Helper to register an item and its opening balance in a specific warehouse
  const registerItem = (
    sku: string,
    name_ar: string,
    categoryId: number,
    unitId: number,
    warehouseId: number,
    openQty: number,
    minStock: number,
    notes: string,
    expiryTracking = true
  ) => {
    const id = nextItemId++;
    const item: Item = {
      id,
      sku,
      name_ar,
      category_id: categoryId,
      base_unit_id: unitId,
      minimum_stock: minStock,
      expiry_tracking: expiryTracking,
      is_active: true,
      notes,
      created_at: now,
      updated_at: now
    };
    items.push(item);

    if (openQty > 0) {
      const mov: StockMovement = {
        id: nextMovId++,
        movement_no: `OP-${id.toString().padStart(4, '0')}`,
        movement_type: 'OPENING',
        item_id: id,
        warehouse_id: warehouseId,
        quantity: openQty,
        direction: 'IN',
        signed_quantity: openQty,
        unit_id: unitId,
        user_id: 1,
        occurred_at: now,
        created_at: now,
        notes: `رصيد افتتاحي: ${notes} (مستودع: ${warehouseId})`
      };
      movements.push(mov);
    }
  };

  // ==========================================
  // 1. المخزن الرئيسي (Warehouse 1: MAIN)
  // ==========================================
  const mainItems = [
    { name: 'حامل زراع اطفال', cat: 6, unit: 1, qty: 50, min: 10, expiry: false },
    { name: 'خافض لسان', cat: 2, unit: 2, qty: 100, min: 20, expiry: false },
    { name: 'ورق رسم قلب', cat: 2, unit: 6, qty: 80, min: 15, expiry: false },
    { name: 'سرنجه 3 سم', cat: 2, unit: 2, qty: 500, min: 100, expiry: true },
    { name: 'مناديل سحب', cat: 2, unit: 2, qty: 150, min: 30, expiry: false },
    { name: 'شاش مقاس 15', cat: 2, unit: 2, qty: 200, min: 40, expiry: true },
    { name: 'شاش مقاس 10', cat: 2, unit: 2, qty: 250, min: 50, expiry: true },
    { name: 'شاش مقاس 7', cat: 2, unit: 2, qty: 200, min: 40, expiry: true },
    { name: 'شاش مقاس 5', cat: 2, unit: 2, qty: 180, min: 30, expiry: true },
    { name: 'رباط ضاغط 15', cat: 6, unit: 1, qty: 120, min: 25, expiry: false },
    { name: 'رباط ضاغط 10', cat: 6, unit: 1, qty: 150, min: 30, expiry: false },
    { name: 'رباط ضاغط 8', cat: 6, unit: 1, qty: 100, min: 20, expiry: false },
    { name: 'كحول صغير', cat: 1, unit: 1, qty: 120, min: 25, expiry: true },
    { name: 'سيفتى بوكس', cat: 2, unit: 1, qty: 90, min: 20, expiry: false },
    { name: 'محلول ملح', cat: 1, unit: 5, qty: 400, min: 80, expiry: true },
    { name: 'كحول كبير', cat: 1, unit: 1, qty: 80, min: 15, expiry: true },
    { name: 'ماء اكسجين 10', cat: 1, unit: 1, qty: 60, min: 10, expiry: true },
    { name: 'ماء اكسجين 20', cat: 1, unit: 1, qty: 60, min: 10, expiry: true },
    { name: 'ماء اكسجين 30', cat: 1, unit: 1, qty: 60, min: 10, expiry: true },
    { name: 'جلافزات فحص', cat: 2, unit: 2, qty: 300, min: 60, expiry: false },
    { name: 'مناديل رول', cat: 2, unit: 6, qty: 100, min: 20, expiry: false },
    { name: 'جبس بلاستيك 4', cat: 6, unit: 1, qty: 70, min: 15, expiry: false },
    { name: 'جبس بلاستيك 5', cat: 6, unit: 1, qty: 60, min: 15, expiry: false },
    { name: 'جبس بلاستيك 3', cat: 6, unit: 1, qty: 50, min: 10, expiry: false },
    { name: 'صوف بان 7.5', cat: 6, unit: 6, qty: 80, min: 20, expiry: false },
    { name: 'صوف بان 10', cat: 6, unit: 6, qty: 90, min: 20, expiry: false },
    { name: 'صوف بان 15', cat: 6, unit: 6, qty: 70, min: 15, expiry: false },
    { name: 'جبسونا 15', cat: 6, unit: 6, qty: 100, min: 25, expiry: false },
    { name: 'جبسونا 10', cat: 6, unit: 6, qty: 120, min: 25, expiry: false },
    { name: 'جبسونا 7.5', cat: 6, unit: 6, qty: 90, min: 20, expiry: false },
    { name: 'كمامات', cat: 2, unit: 2, qty: 500, min: 100, expiry: false },
    { name: 'لولب', cat: 2, unit: 1, qty: 40, min: 10, expiry: true },
    { name: 'فرش اسنان', cat: 2, unit: 1, qty: 80, min: 15, expiry: false },
    { name: 'فرش غسيل الالات', cat: 4, unit: 1, qty: 50, min: 10, expiry: false },
    { name: 'شاش فازلين معقم', cat: 2, unit: 2, qty: 150, min: 30, expiry: true },
    { name: 'زجاجة جيل', cat: 2, unit: 1, qty: 60, min: 15, expiry: true },
    { name: 'جلافزات لاتكس', cat: 2, unit: 2, qty: 350, min: 70, expiry: false },
    { name: 'قطن ماص 100 جم', cat: 2, unit: 1, qty: 140, min: 30, expiry: false },
    { name: 'شكاكات قلم', cat: 2, unit: 2, qty: 200, min: 40, expiry: true },
    { name: 'كيناكومب كريم', cat: 1, unit: 7, qty: 70, min: 15, expiry: true },
    { name: 'اسكراب تمريض', cat: 2, unit: 1, qty: 40, min: 10, expiry: false },
    { name: 'دفتر روشتات', cat: 2, unit: 1, qty: 50, min: 10, expiry: false },
    { name: 'تاول ( فرش ادوات)', cat: 2, unit: 1, qty: 80, min: 20, expiry: false },
    { name: 'لمبه حمراء علاج ط', cat: 4, unit: 1, qty: 15, min: 5, expiry: false },
    { name: 'حفاضات كبار', cat: 2, unit: 2, qty: 90, min: 20, expiry: false },
    { name: 'غيار جرحى 8', cat: 2, unit: 1, qty: 110, min: 25, expiry: true },
    { name: 'غيار جرحى صغير', cat: 2, unit: 1, qty: 150, min: 30, expiry: true },
    { name: 'غيار جرحى 10', cat: 2, unit: 1, qty: 100, min: 20, expiry: true },
    { name: 'حقنه شرجيه', cat: 2, unit: 1, qty: 60, min: 15, expiry: true },
    { name: 'جلسرين مانزا', cat: 1, unit: 2, qty: 80, min: 20, expiry: true },
    { name: 'دوقلاك', cat: 1, unit: 1, qty: 50, min: 10, expiry: true },
    { name: 'لزق قيصرية', cat: 2, unit: 1, qty: 100, min: 20, expiry: true },
    { name: 'مرتبة طبية', cat: 4, unit: 1, qty: 10, min: 2, expiry: false },
    { name: 'سرنجات انسولين', cat: 2, unit: 2, qty: 300, min: 50, expiry: true },
    { name: 'اغلفة اشعة', cat: 2, unit: 2, qty: 120, min: 25, expiry: false }
  ];

  mainItems.forEach((m, idx) => {
    registerItem(
      `MAIN-${(idx + 1).toString().padStart(3, '0')}`,
      m.name,
      m.cat,
      m.unit,
      1, // المخزن الرئيسي
      m.qty,
      m.min,
      'المخزن الرئيسي',
      m.expiry
    );
  });

  // ==========================================
  // 2. مستهلكات العمليات (Warehouse 4: ORSU)
  // ==========================================
  const orSupplies = [
    { name: 'جلوكوز 5%', cat: 1, unit: 5, qty: 250, min: 50 },
    { name: 'محلول ملح عمليات', cat: 1, unit: 5, qty: 300, min: 60 },
    { name: 'محلول رينجر', cat: 1, unit: 5, qty: 250, min: 50 },
    { name: 'كيس جمع بول', cat: 2, unit: 1, qty: 180, min: 40 },
    { name: 'جهاز محاليل', cat: 2, unit: 1, qty: 350, min: 70 },
    { name: 'جهاز نقل دم', cat: 2, unit: 1, qty: 120, min: 30 },
    { name: 'فوط بطن', cat: 3, unit: 2, qty: 100, min: 25 },
    { name: 'كابل دياثيرمى', cat: 4, unit: 1, qty: 20, min: 5 },
    { name: 'جلوكوز 10%', cat: 1, unit: 5, qty: 150, min: 30 },
    { name: 'جهاز بى سي ايه', cat: 4, unit: 1, qty: 15, min: 5 },
    { name: 'نيلون لوب 1 راوند', cat: 3, unit: 2, qty: 60, min: 15 },
    { name: 'نيلون 0 راوند', cat: 3, unit: 2, qty: 60, min: 15 },
    { name: 'برولين قاطع 5/0', cat: 3, unit: 2, qty: 80, min: 20 },
    { name: 'برولين قاطع 6/0', cat: 3, unit: 2, qty: 70, min: 15 },
    { name: 'برولين قاطع 3/0', cat: 3, unit: 2, qty: 90, min: 20 },
    { name: 'برولين قاطع 1', cat: 3, unit: 2, qty: 85, min: 20 },
    { name: 'برولين قاطع 0', cat: 3, unit: 2, qty: 90, min: 20 },
    { name: 'برولين زيرو راوند', cat: 3, unit: 2, qty: 75, min: 15 },
    { name: 'كرومك 4/0 قاطع', cat: 3, unit: 2, qty: 70, min: 15 },
    { name: 'فيكريل 4/0 قاطع', cat: 3, unit: 2, qty: 80, min: 20 },
    { name: 'فيكريل 4/0 راوند', cat: 3, unit: 2, qty: 70, min: 15 },
    { name: 'فيكريل 3/0 قاطع', cat: 3, unit: 2, qty: 85, min: 20 },
    { name: 'خيط حرير 1 قاطع', cat: 3, unit: 2, qty: 90, min: 20 },
    { name: 'برولين 2/0 قاطع', cat: 3, unit: 2, qty: 80, min: 20 },
    { name: 'برولين 4/0 قاطع', cat: 3, unit: 2, qty: 75, min: 15 },
    { name: 'فيكريل 1 قاطع', cat: 3, unit: 2, qty: 80, min: 20 },
    { name: 'فيكريل 1 راوند', cat: 3, unit: 2, qty: 75, min: 15 },
    { name: 'فيكريل 5/0 قاطع', cat: 3, unit: 2, qty: 70, min: 15 },
    { name: 'فيكريل فاست 2/0 قاطع', cat: 3, unit: 2, qty: 65, min: 15 },
    { name: 'سرنجة 50 سم', cat: 2, unit: 1, qty: 120, min: 30 },
    { name: 'ابرة اسبينال برتقالى', cat: 3, unit: 1, qty: 90, min: 20 },
    { name: 'ابرة اسبينال اسود', cat: 3, unit: 1, qty: 80, min: 20 },
    { name: 'جاون طبيب معقم', cat: 3, unit: 1, qty: 150, min: 35 },
    { name: 'جاون مريض', cat: 2, unit: 1, qty: 180, min: 40 },
    { name: 'ممر هوائى برتقالى', cat: 3, unit: 1, qty: 50, min: 10 },
    { name: 'ممر هوائى اصفر', cat: 3, unit: 1, qty: 50, min: 10 },
    { name: 'ممر هوائى اخضر', cat: 3, unit: 1, qty: 50, min: 10 },
    { name: 'ممر هوائى ابيض', cat: 3, unit: 1, qty: 50, min: 10 },
    { name: 'نيزل اكسجين', cat: 2, unit: 1, qty: 120, min: 30 },
    { name: 'ماسك اكسجين عمليات', cat: 2, unit: 1, qty: 130, min: 30 },
    { name: 'تيوب بدون كف مقاس 5', cat: 3, unit: 1, qty: 40, min: 10 },
    { name: 'تيوب بدون كف مقاس 4.5', cat: 3, unit: 1, qty: 40, min: 10 },
    { name: 'تيوب بدون كف مقاس 4', cat: 3, unit: 1, qty: 40, min: 10 },
    { name: 'تيوب بدون كف مقاس 3.5', cat: 3, unit: 1, qty: 40, min: 10 },
    { name: 'تيوب بدون كف مقاس 3', cat: 3, unit: 1, qty: 40, min: 10 },
    { name: 'تيوب بدون كف مقاس 2', cat: 3, unit: 1, qty: 40, min: 10 },
    { name: 'تيوب بكف مقاس 8', cat: 3, unit: 1, qty: 60, min: 15 },
    { name: 'تيوب بكف مقاس 7.5', cat: 3, unit: 1, qty: 65, min: 15 },
    { name: 'تيوب بكف مقاس 7', cat: 3, unit: 1, qty: 60, min: 15 },
    { name: 'تيوب بكف مقاس 6.5', cat: 3, unit: 1, qty: 50, min: 10 },
    { name: 'تيوب بكف مقاس 6', cat: 3, unit: 1, qty: 50, min: 10 },
    { name: 'تيوب بكف مقاس 5.5', cat: 3, unit: 1, qty: 45, min: 10 },
    { name: 'تيوب بكف مقاس 5', cat: 3, unit: 1, qty: 45, min: 10 },
    { name: 'تيوب بكف مقاس 4.5', cat: 3, unit: 1, qty: 40, min: 10 },
    { name: 'تيوب بكف مقاس 4', cat: 3, unit: 1, qty: 40, min: 10 },
    { name: 'تيوب بكف مقاس 3.5', cat: 3, unit: 1, qty: 35, min: 10 },
    { name: 'تيوب بكف مقاس 3', cat: 3, unit: 1, qty: 35, min: 10 },
    { name: 'فيكريل 3/0 راوند', cat: 3, unit: 2, qty: 75, min: 15 },
    { name: 'فيكريل 2/0 راوند', cat: 3, unit: 2, qty: 80, min: 20 },
    { name: 'فيكريل 2/0 قاطع', cat: 3, unit: 2, qty: 85, min: 20 },
    { name: 'علبه عينة باثولوجي', cat: 2, unit: 1, qty: 110, min: 25 },
    { name: 'جوانتى معقم مقاس 8', cat: 3, unit: 2, qty: 250, min: 50 },
    { name: 'طقم سي جراحة', cat: 3, unit: 1, qty: 30, min: 8 },
    { name: 'علبة مشبك سرة', cat: 2, unit: 2, qty: 50, min: 10 },
    { name: 'كانيولا بنفسجى', cat: 2, unit: 1, qty: 140, min: 30 },
    { name: 'كانيولا صفراء', cat: 2, unit: 1, qty: 150, min: 30 },
    { name: 'كانيولا زرقاء', cat: 2, unit: 1, qty: 160, min: 35 },
    { name: 'كانيولا خضراء', cat: 2, unit: 1, qty: 150, min: 30 },
    { name: 'كانيولا بمبى', cat: 2, unit: 1, qty: 150, min: 30 },
    { name: 'رايل مقاس 18', cat: 3, unit: 1, qty: 60, min: 15 },
    { name: 'رايل مقاس 20', cat: 3, unit: 1, qty: 60, min: 15 },
    { name: 'رايل مقاس 16', cat: 3, unit: 1, qty: 60, min: 15 },
    { name: 'قسطره فولى مقاس 18', cat: 3, unit: 1, qty: 80, min: 20 },
    { name: 'قسطرة نيلتون ابيض', cat: 3, unit: 1, qty: 50, min: 10 },
    { name: 'قسطرة نيلتون ازرق', cat: 3, unit: 1, qty: 50, min: 10 },
    { name: 'قسطرة نيلتون اصفر', cat: 3, unit: 1, qty: 50, min: 10 },
    { name: 'قسطرة نيلتون لبنى', cat: 3, unit: 1, qty: 50, min: 10 },
    { name: 'قسطرة نيلتون اخضر', cat: 3, unit: 1, qty: 50, min: 10 },
    { name: 'قسطرة نيلتون برتقالى', cat: 3, unit: 1, qty: 50, min: 10 },
    { name: 'قسطرة نيلتون احمر', cat: 3, unit: 1, qty: 50, min: 10 },
    { name: 'قسطرة نيلتون اسود', cat: 3, unit: 1, qty: 50, min: 10 },
    { name: 'قسطرة ريكتال رصاصى', cat: 3, unit: 1, qty: 45, min: 10 },
    { name: 'قسطرة ريكتال بنفسجى', cat: 3, unit: 1, qty: 45, min: 10 },
    { name: 'اكياس لايزو', cat: 2, unit: 1, qty: 90, min: 20 },
    { name: 'رباط ضاغط 15 عمليات', cat: 6, unit: 1, qty: 80, min: 20 },
    { name: 'رباط ضاغط 10 عمليات', cat: 6, unit: 1, qty: 80, min: 20 },
    { name: 'سرنجات 1 سم', cat: 2, unit: 2, qty: 250, min: 50 },
    { name: 'سرنجات 3 سم عمليات', cat: 2, unit: 2, qty: 350, min: 70 },
    { name: 'سرنجات 5 سم عمليات', cat: 2, unit: 2, qty: 350, min: 70 },
    { name: 'سرنجات 10 سم عمليات', cat: 2, unit: 2, qty: 280, min: 60 },
    { name: 'سرنجات 20 سم عمليات', cat: 2, unit: 2, qty: 160, min: 35 },
    { name: 'سرنجات انسولين عمليات', cat: 2, unit: 2, qty: 200, min: 40 },
    { name: 'جوانتى معقم 7.5 عمليات', cat: 3, unit: 2, qty: 260, min: 50 },
    { name: 'مشرط مقاس 11', cat: 3, unit: 2, qty: 100, min: 20 },
    { name: 'مشرط مقاس 15', cat: 3, unit: 2, qty: 120, min: 25 },
    { name: 'مشرط مقاس 21', cat: 3, unit: 2, qty: 80, min: 20 },
    { name: 'مشرط مقاس 24', cat: 3, unit: 2, qty: 80, min: 20 },
    { name: 'برولين 1 راوند', cat: 3, unit: 2, qty: 80, min: 20 },
    { name: 'دريسنج مقاس 10*25', cat: 3, unit: 1, qty: 120, min: 25 },
    { name: 'دريسنج مقاس 10*35', cat: 3, unit: 1, qty: 100, min: 20 },
    { name: 'ماء اكسجين عمليات', cat: 1, unit: 1, qty: 50, min: 10 },
    { name: 'جلسرين منازيا عمليات', cat: 1, unit: 2, qty: 60, min: 15 },
    { name: 'قسطره فولى مقاس 16', cat: 3, unit: 1, qty: 90, min: 20 },
    { name: 'ايجى فاك درنقة', cat: 3, unit: 1, qty: 45, min: 10 },
    { name: 'برولين 4/0 راوند', cat: 3, unit: 2, qty: 75, min: 15 },
    { name: 'برولين 3/0 راوند', cat: 3, unit: 2, qty: 80, min: 20 },
    { name: 'برولين 2/0 راوند', cat: 3, unit: 2, qty: 80, min: 20 },
    { name: 'فيكريل 0 راوند', cat: 3, unit: 2, qty: 75, min: 15 },
    { name: 'جوانتى لاتكس عمليات', cat: 3, unit: 2, qty: 300, min: 60 },
    { name: 'مفرش قيصرية معقم', cat: 3, unit: 1, qty: 60, min: 15 },
    { name: 'كحول عمليات معقم', cat: 1, unit: 1, qty: 90, min: 20 }
  ];

  orSupplies.forEach((s, idx) => {
    registerItem(
      `OR-SU-${(idx + 1).toString().padStart(3, '0')}`,
      s.name,
      s.cat,
      s.unit,
      4, // مخزن مستلزمات العمليات
      s.qty,
      s.min,
      'مستهلكات العمليات'
    );
  });

  // ==========================================
  // 3. أدوية العمليات (Warehouse 3: ORDR)
  // ==========================================
  const orDrugs = [
    { name: 'ليدوكايين 2%', cat: 1, unit: 4, qty: 150, min: 30 },
    { name: 'كابرون امبول', cat: 1, unit: 3, qty: 120, min: 25 },
    { name: 'ديكلوفين امبول', cat: 1, unit: 3, qty: 140, min: 30 },
    { name: 'بريمبران امبول', cat: 1, unit: 3, qty: 160, min: 30 },
    { name: 'سنتوسينون امبول', cat: 1, unit: 3, qty: 110, min: 25 },
    { name: 'اتروبين امبول', cat: 1, unit: 3, qty: 200, min: 40 },
    { name: 'نتوستجمين امبول', cat: 1, unit: 3, qty: 90, min: 20 },
    { name: 'جسترودين امبول', cat: 1, unit: 3, qty: 80, min: 20 },
    { name: 'ادرينالين امبول', cat: 1, unit: 3, qty: 180, min: 40 },
    { name: 'بربوفول (ديبريفان)', cat: 1, unit: 4, qty: 130, min: 30 },
    { name: 'سبازموفرى امبول', cat: 1, unit: 3, qty: 100, min: 20 },
    { name: 'ميثرجين امبول', cat: 1, unit: 3, qty: 90, min: 20 },
    { name: 'نالوفين امبول', cat: 1, unit: 3, qty: 70, min: 15 },
    { name: 'ميزوتاك اقراص', cat: 1, unit: 8, qty: 50, min: 10 },
    { name: 'ديكسا امبول', cat: 1, unit: 3, qty: 180, min: 40 },
    { name: 'كيتولاك امبول', cat: 1, unit: 3, qty: 160, min: 35 },
    { name: 'اتروفينت نقط كبار', cat: 1, unit: 1, qty: 60, min: 15 },
    { name: 'اوكسميد نقط صغار', cat: 1, unit: 1, qty: 50, min: 10 },
    { name: 'سيتال لبوس اطفال', cat: 1, unit: 2, qty: 70, min: 15 },
    { name: 'فولتارين لبوس اطفال', cat: 1, unit: 2, qty: 65, min: 15 },
    { name: 'بيثدين امبول', cat: 1, unit: 3, qty: 60, min: 15 },
    { name: 'دايسينون امبول', cat: 1, unit: 3, qty: 110, min: 25 },
    { name: 'امرى ك امبول', cat: 1, unit: 3, qty: 80, min: 20 },
    { name: 'هيدروكورتيزون فيال', cat: 1, unit: 4, qty: 120, min: 25 },
    { name: 'افيل امبول', cat: 1, unit: 3, qty: 130, min: 30 },
    { name: 'تراكيام امبول', cat: 1, unit: 3, qty: 90, min: 20 },
    { name: 'ميداستك امبول', cat: 1, unit: 3, qty: 85, min: 20 },
    { name: 'كيتامين فيال', cat: 1, unit: 4, qty: 70, min: 15 },
    { name: 'سكسينيل فيال', cat: 1, unit: 4, qty: 60, min: 15 },
    { name: 'افيدرين امبول', cat: 1, unit: 3, qty: 90, min: 20 },
    { name: 'ايتافلين امبول', cat: 1, unit: 3, qty: 80, min: 20 },
    { name: 'ماركين فيال هيفي', cat: 1, unit: 4, qty: 75, min: 15 },
    { name: 'ماركين امبول سبينال', cat: 1, unit: 3, qty: 80, min: 20 },
    { name: 'كريم بريدكين', cat: 1, unit: 7, qty: 60, min: 15 },
    { name: 'كريم فيوسى', cat: 1, unit: 7, qty: 70, min: 15 },
    { name: 'ليجنو كايين كريم', cat: 1, unit: 7, qty: 80, min: 20 },
    { name: 'ديكلوفين لبوس كبار', cat: 1, unit: 2, qty: 90, min: 20 },
    { name: 'فولتارين لبوس كبار', cat: 1, unit: 2, qty: 85, min: 20 },
    { name: 'دولفين 50 لبوس', cat: 1, unit: 2, qty: 80, min: 20 },
    { name: 'دولفين 12.5 لبوس', cat: 1, unit: 2, qty: 80, min: 20 },
    { name: 'دولفين ك لبوس', cat: 1, unit: 2, qty: 70, min: 15 },
    { name: 'دولفين 25 لبوس', cat: 1, unit: 2, qty: 75, min: 15 },
    { name: 'بارسيتامول (انجكتامول)', cat: 1, unit: 4, qty: 150, min: 35 },
    { name: 'ايزوفلوران تخدير', cat: 1, unit: 1, qty: 25, min: 5 },
    { name: 'هالوثان تخدير', cat: 1, unit: 1, qty: 20, min: 5 },
    { name: 'سيبروفلوكسسين وريدي', cat: 1, unit: 5, qty: 120, min: 25 },
    { name: 'سيفوتاكس 1 جم فيال', cat: 1, unit: 4, qty: 160, min: 35 },
    { name: 'سيفازون بلس فيال', cat: 1, unit: 4, qty: 110, min: 25 },
    { name: 'ليجنو كايين سبراى', cat: 1, unit: 1, qty: 50, min: 10 },
    { name: 'جاراميسين مرهم', cat: 1, unit: 7, qty: 60, min: 15 },
    { name: 'درموفيت مرهم', cat: 1, unit: 7, qty: 50, min: 10 },
    { name: 'درموفيت كريم', cat: 1, unit: 7, qty: 50, min: 10 },
    { name: 'سيفو باكستر فيال', cat: 1, unit: 4, qty: 90, min: 20 },
    { name: 'جاراميسين امبول', cat: 1, unit: 3, qty: 130, min: 25 },
    { name: 'فيوسيدين كريم', cat: 1, unit: 7, qty: 70, min: 15 },
    { name: 'فيوسيدين مرهم', cat: 1, unit: 7, qty: 60, min: 15 },
    { name: 'زوفاترون امبول', cat: 1, unit: 3, qty: 110, min: 25 }
  ];

  orDrugs.forEach((d, idx) => {
    registerItem(
      `OR-DR-${(idx + 1).toString().padStart(3, '0')}`,
      d.name,
      d.cat,
      d.unit,
      3, // مخزن أدوية العمليات الجراحية
      d.qty,
      d.min,
      'أدوية العمليات'
    );
  });

  // ==========================================
  // 4. مستلزمات وأدوية الطوارئ (Warehouse 2: EMER)
  // ==========================================
  const emerItems = [
    // أدوية وحقن
    { name: 'دانست 4 امبول', cat: 5, unit: 3, qty: 100, min: 20 },
    { name: 'دانست 8 امبول', cat: 5, unit: 3, qty: 110, min: 25 },
    { name: 'افيل طوارئ', cat: 5, unit: 3, qty: 120, min: 25 },
    { name: 'بريمبران طوارئ', cat: 5, unit: 3, qty: 150, min: 30 },
    { name: 'ديكسا طوارئ', cat: 5, unit: 3, qty: 160, min: 30 },
    { name: 'ديكلوفين طوارئ', cat: 5, unit: 3, qty: 140, min: 30 },
    { name: 'فولتارين امبول طوارئ', cat: 5, unit: 3, qty: 150, min: 30 },
    { name: 'كيتولاك طوارئ', cat: 5, unit: 3, qty: 160, min: 35 },
    { name: 'دايسنون طوارئ', cat: 5, unit: 3, qty: 110, min: 20 },
    { name: 'كابرون طوارئ', cat: 5, unit: 3, qty: 120, min: 25 },
    { name: 'سبازموفرى طوارئ', cat: 5, unit: 3, qty: 100, min: 20 },
    { name: 'بى كوم امبول', cat: 5, unit: 3, qty: 80, min: 20 },
    { name: 'بيكوزم امبول', cat: 5, unit: 3, qty: 80, min: 20 },
    { name: 'باور بي كومبلكس', cat: 5, unit: 3, qty: 70, min: 15 },
    { name: 'سيربروسيتام امبول', cat: 5, unit: 3, qty: 60, min: 15 },
    { name: 'كنتورلوك 40 فيال', cat: 5, unit: 4, qty: 130, min: 25 },
    { name: 'انجكتامول طوارئ', cat: 5, unit: 4, qty: 160, min: 30 },
    { name: 'فاركولين محلول استنشاق', cat: 5, unit: 1, qty: 70, min: 15 },
    { name: 'اتروفينت 500 استنشاق', cat: 5, unit: 1, qty: 60, min: 15 },
    { name: 'بالميكورت 500 استنشاق', cat: 5, unit: 1, qty: 70, min: 15 },
    { name: 'اتروفينت 250 استنشاق', cat: 5, unit: 1, qty: 60, min: 15 },
    { name: 'بالميكورت 250 استنشاق', cat: 5, unit: 1, qty: 65, min: 15 },
    { name: 'ماء اكسجين طوارئ', cat: 5, unit: 1, qty: 70, min: 15 },
    { name: 'اتروفين نقط كبار', cat: 5, unit: 1, qty: 50, min: 10 },
    { name: 'اتروفين نقط اطفال', cat: 5, unit: 1, qty: 50, min: 10 },
    { name: 'كورتيزون امبول', cat: 5, unit: 3, qty: 90, min: 20 },
    { name: 'ادرينالين طوارئ', cat: 5, unit: 3, qty: 150, min: 30 },
    { name: 'جاستروتيدين امبول', cat: 5, unit: 3, qty: 90, min: 20 },
    { name: 'هيدروكوتيزون طوارئ', cat: 5, unit: 4, qty: 110, min: 25 },
    { name: 'انتودين 20 امبول', cat: 5, unit: 3, qty: 120, min: 25 },
    // المحاليل والمستلزمات
    { name: 'محلول ملح طوارئ', cat: 1, unit: 5, qty: 350, min: 70 },
    { name: 'جلوكوز 5% طوارئ', cat: 1, unit: 5, qty: 250, min: 50 },
    { name: 'جلوكوز 10% طوارئ', cat: 1, unit: 5, qty: 180, min: 35 },
    { name: 'محلول رينجر طوارئ', cat: 1, unit: 5, qty: 260, min: 50 },
    { name: 'جهاز نقل دم طوارئ', cat: 5, unit: 1, qty: 90, min: 20 },
    { name: 'جهاز محاليل طوارئ', cat: 5, unit: 1, qty: 300, min: 60 },
    { name: 'كانيولا اصفر طوارئ', cat: 5, unit: 1, qty: 160, min: 35 },
    { name: 'كانيولا بنفسجى طوارئ', cat: 5, unit: 1, qty: 140, min: 30 },
    { name: 'كانيولا ازرق طوارئ', cat: 5, unit: 1, qty: 170, min: 35 },
    // أدوات الخياطة
    { name: 'برولين 1 قاطع طوارئ', cat: 3, unit: 2, qty: 70, min: 15 },
    { name: 'برولين 2/0 قاطع طوارئ', cat: 3, unit: 2, qty: 80, min: 20 },
    { name: 'برولين 3/0 قاطع طوارئ', cat: 3, unit: 2, qty: 85, min: 20 },
    { name: 'برولين 4/0 قاطع طوارئ', cat: 3, unit: 2, qty: 75, min: 15 },
    { name: 'برولين 5/0 قاطع طوارئ', cat: 3, unit: 2, qty: 70, min: 15 },
    { name: 'برولين قاطع 6/0 طوارئ', cat: 3, unit: 2, qty: 60, min: 15 },
    { name: 'فيكريل 2/0 راوند طوارئ', cat: 3, unit: 2, qty: 75, min: 15 },
    { name: 'فيكريل 5/0 قاطع طوارئ', cat: 3, unit: 2, qty: 65, min: 15 },
    { name: 'فيكريل 5/0 راوند طوارئ', cat: 3, unit: 2, qty: 65, min: 15 },
    { name: 'ليدو كايين طوارئ', cat: 1, unit: 4, qty: 120, min: 25 },
    { name: 'فيكريل 4/0 قاطع طوارئ', cat: 3, unit: 2, qty: 70, min: 15 },
    // أقراص
    { name: 'اسبرين بروتكت 100', cat: 1, unit: 8, qty: 80, min: 20 },
    { name: 'بلافيكس 75 ملجم', cat: 1, unit: 8, qty: 60, min: 15 },
    { name: 'كابوتين 25 ملجم', cat: 1, unit: 8, qty: 70, min: 15 },
    { name: 'داينترا تحت اللسان', cat: 1, unit: 8, qty: 50, min: 10 },
    // أجهزة ومعدات
    { name: 'جهاز ضغط زئبقي/هوائي', cat: 4, unit: 1, qty: 12, min: 3 },
    { name: 'جهاز قياس سكر بالدم', cat: 4, unit: 1, qty: 15, min: 4 },
    { name: 'مونيتور مراقبة المريض', cat: 4, unit: 1, qty: 8, min: 2 },
    { name: 'جهاز رسم قلب طوارئ', cat: 4, unit: 1, qty: 6, min: 2 },
    { name: 'جهاز اسطوانة اكسجين', cat: 4, unit: 1, qty: 10, min: 3 },
    { name: 'شرائط اسيتون بول', cat: 5, unit: 2, qty: 40, min: 10 },
    { name: 'ترموميتر حرارة رقمي', cat: 4, unit: 1, qty: 25, min: 5 },
    { name: 'جهاز استنشاق نبيولايزر', cat: 4, unit: 1, qty: 12, min: 3 },
    { name: 'ماسكات اكسجين اطفال', cat: 5, unit: 1, qty: 100, min: 20 },
    { name: 'ماسكات اكسجين كبار', cat: 5, unit: 1, qty: 120, min: 25 },
    { name: 'ماسكات استنشاق كبار', cat: 5, unit: 1, qty: 110, min: 20 },
    { name: 'ماسكات استنشاق اطفال', cat: 5, unit: 1, qty: 100, min: 20 },
    // آلات طوارئ
    { name: 'بنس موسكيتو جراحي', cat: 4, unit: 1, qty: 30, min: 5 },
    { name: 'ماسك ابر خياطة', cat: 4, unit: 1, qty: 25, min: 5 },
    { name: 'جفت جراحي غيار', cat: 4, unit: 1, qty: 35, min: 6 },
    { name: 'مقص جراحي غيار', cat: 4, unit: 1, qty: 30, min: 5 },
    { name: 'جفنة ستانلس معقمة', cat: 4, unit: 1, qty: 25, min: 5 },
    { name: 'بكرة رسم قلب طوارئ', cat: 5, unit: 6, qty: 60, min: 15 },
    { name: 'بنج موضعي سبراي', cat: 1, unit: 1, qty: 45, min: 10 },
    { name: 'بلاستر طبي حريري', cat: 5, unit: 6, qty: 90, min: 20 },
    // سرنجات
    { name: 'سرنجات بالكرتونة كبرى', cat: 5, unit: 9, qty: 40, min: 8 },
    { name: 'سرنجه 3 سم طوارئ', cat: 5, unit: 2, qty: 400, min: 80 },
    { name: 'سرنجه 5 سم طوارئ', cat: 5, unit: 2, qty: 350, min: 70 },
    { name: 'سرنجه 10 سم طوارئ', cat: 5, unit: 2, qty: 250, min: 50 },
    { name: 'سرنجه 20 سم طوارئ', cat: 5, unit: 2, qty: 140, min: 30 },
    { name: 'سرنجه 50 سم طوارئ', cat: 5, unit: 1, qty: 90, min: 20 },
    { name: 'سرنجه انسولين طوارئ', cat: 5, unit: 2, qty: 250, min: 50 },
    // مستلزمات وأدوية أخرى
    { name: 'ميبو مرهم حروق', cat: 1, unit: 7, qty: 80, min: 15 },
    { name: 'فيوسيدين مرهم طوارئ', cat: 1, unit: 7, qty: 75, min: 15 },
    { name: 'رباط ضاغط 15 طوارئ', cat: 6, unit: 1, qty: 90, min: 20 },
    { name: 'رباط ضاغط 10 طوارئ', cat: 6, unit: 1, qty: 100, min: 20 },
    { name: 'شاش فازلين طوارئ', cat: 5, unit: 2, qty: 120, min: 25 },
    { name: 'قسطره بولية 16 طوارئ', cat: 3, unit: 1, qty: 70, min: 15 },
    { name: 'شاش طبي 10 سم طوارئ', cat: 5, unit: 2, qty: 200, min: 40 },
    { name: 'شرائط تحليل سكر', cat: 5, unit: 2, qty: 90, min: 20 },
    { name: 'شكاكات قلم طوارئ', cat: 5, unit: 2, qty: 180, min: 35 },
    { name: 'مشرط جراحي 15 طوارئ', cat: 3, unit: 2, qty: 90, min: 20 },
    { name: 'مشرط جراحي 22 طوارئ', cat: 3, unit: 2, qty: 80, min: 20 },
    { name: 'جوانتى طبي فحص طوارئ', cat: 5, unit: 2, qty: 350, min: 70 }
  ];

  emerItems.forEach((e, idx) => {
    registerItem(
      `EMER-${(idx + 1).toString().padStart(3, '0')}`,
      e.name,
      e.cat,
      e.unit,
      2, // مخزن الطوارئ والاستقبال
      e.qty,
      e.min,
      'مستلزمات وأدوية الطوارئ'
    );
  });

  return { items, movements };
}
