import React, { useState, useMemo } from 'react';
import {
  Plus, FolderPlus, Upload, ShieldAlert, Check, FileSpreadsheet,
  ChevronRight, Search, RefreshCw, Layers, Hospital, Download,
  Edit2, Trash2, ArrowDownRight, ArrowUpLeft, X, AlertCircle
} from 'lucide-react';
import { DBSchema, Item, Category, StockMovement, saveDB, resetToHospitalCatalog } from '../data/db';

interface ItemsViewProps {
  db: DBSchema;
  user: any;
  onRefresh: () => void;
  stockBalances: Record<string, number>;
}

export const ItemsView: React.FC<ItemsViewProps> = ({ db, user, onRefresh }) => {
  const [activeSubTab, setActiveSubTab] = useState<'ITEMS' | 'CATEGORIES' | 'IMPORT'>('ITEMS');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState<'ALL' | 'MAIN' | 'ORSU' | 'ORDR' | 'EMER'>('ALL');
  const [catFilter, setCatFilter] = useState<number | 'ALL'>('ALL');

  // Modals state
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingItem, setEditingItem] = useState<{ item: Item; openingQty: number } | null>(null);
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);
  const [quickInItem, setQuickInItem] = useState<{ item: Item; whId: number; deptName: string } | null>(null);
  const [quickOutItem, setQuickOutItem] = useState<{ item: Item; whId: number; maxQty: number; deptName: string } | null>(null);

  // Form State for Add Item
  const [sku, setSku] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [targetDept, setTargetDept] = useState<'MAIN' | 'ORSU' | 'ORDR' | 'EMER'>('MAIN');
  const [openingQty, setOpeningQty] = useState<number>(0);
  const [categoryId, setCategoryId] = useState<number>(1);
  const [baseUnitId, setBaseUnitId] = useState<number>(1);
  const [minimumStock, setMinimumStock] = useState<number>(20);
  const [expiryTracking, setExpiryTracking] = useState(true);

  // Form State for Edit Item
  const [editName, setEditName] = useState('');
  const [editOpeningQty, setEditOpeningQty] = useState<number>(0);
  const [editUnitId, setEditUnitId] = useState<number>(1);
  const [editMinStock, setEditMinStock] = useState<number>(20);
  const [editCategoryId, setEditCategoryId] = useState<number>(1);

  // Quick Movement State (+ In / - Out)
  const [quickQty, setQuickQty] = useState<number>(1);
  const [quickDate, setQuickDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [quickNotes, setQuickNotes] = useState<string>('');

  // Add Category Form State
  const [catCode, setCatCode] = useState('');
  const [catName, setCatName] = useState('');

  // Excel Import Wizard Simulator State
  const [importStep, setImportStep] = useState<number>(1);
  const [selectedSheet, setSelectedSheet] = useState<string>('مخازن_مستلزمات_2026.xlsx');
  const [mappedColumns, setMappedColumns] = useState<Record<string, string>>({
    'اسم الصنف': 'name_ar',
    'الرمز الفريد SKU': 'sku',
    'الرصيد الافتتاحي': 'quantity',
    'الوحدة الأساسية': 'unit_name'
  });

  const [importAnomalies, setImportAnomalies] = useState<any[]>([
    { id: 1, type: 'DUPLICATE_SKU', item: 'بنادول 500 ملجم أقراص', code: 'MED-001', text: 'الصنف موجود مسبقاً بقاعدة البيانات.', action: 'MERGE', action_opts: ['دمج الرصيد (جمع)', 'تجاهل السطر', 'إنشاء صنف مكرر برمز جديد'] },
    { id: 2, type: 'NEGATIVE_QTY', item: 'قطن طبي معقم 100 جم', code: 'DISP-106', text: 'الكمية المدخلة سالبة (-5).', action: 'FIX_QTY', value: '15', action_opts: ['تصحيح إلى 15 قطعة', 'تخطي السطر'] },
    { id: 3, type: 'MISSING_SKU', item: 'شريط قياس حرارة جبهي', code: 'AUTO-GEN', text: 'الرمز الفريد SKU مفقود.', action: 'GEN_SKU', action_opts: ['توليد تلقائي (DISP-983)', 'إدخال يدوي'] },
    { id: 4, type: 'UNIT_MISMATCH', item: 'خياطة جراحية حرير 2-0', code: 'SURG-110', text: 'الوحدة (PACK) غير معرفة في النظام.', action: 'MAP_UNIT', value: 'PCS', action_opts: ['ربطها بالوحدة (قطعة)', 'إضافة PACK كوحدة جديدة'] }
  ]);

  const canEdit = user.role === 'ADMIN' || user.role === 'STORE_MANAGER' || user.role === 'STORE_USER';

  // Helper to get warehouse ID and department label from item
  const getItemDeptInfo = (item: Item) => {
    if (item.notes === 'المخزن الرئيسي' || item.sku.startsWith('MAIN-')) {
      return { id: 1, key: 'MAIN', name: 'المخزن الرئيسي', badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
    }
    if (item.notes === 'مستهلكات العمليات' || item.sku.startsWith('OR-SU-')) {
      return { id: 4, key: 'ORSU', name: 'مستهلكات العمليات', badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30' };
    }
    if (item.notes === 'أدوية العمليات' || item.sku.startsWith('OR-DR-')) {
      return { id: 3, key: 'ORDR', name: 'أدوية العمليات', badgeClass: 'bg-teal-500/10 text-teal-400 border-teal-500/30' };
    }
    if (item.notes === 'مستلزمات وأدوية الطوارئ' || item.sku.startsWith('EMER-')) {
      return { id: 2, key: 'EMER', name: 'طوارئ واستقبال', badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
    }
    return { id: 1, key: 'MAIN', name: 'عام', badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/30' };
  };

  // Compute live spreadsheet ledger rows for all items
  const ledgerRows = useMemo(() => {
    return db.items.map((item, index) => {
      const dept = getItemDeptInfo(item);
      const whId = dept.id;

      // 1. بضاعة أول المدة
      const openingMovs = db.movements.filter(
        m => m.item_id === item.id && (m.warehouse_id === whId || whId === 1) && m.movement_type === 'OPENING'
      );
      const openingStock = openingMovs.reduce((sum, m) => sum + m.signed_quantity, 0);

      // 2. الإضافة (Inflow)
      const inMovs = db.movements.filter(
        m => m.item_id === item.id && m.movement_type !== 'OPENING' && m.direction === 'IN'
      );
      const addQty = inMovs.reduce((sum, m) => sum + m.signed_quantity, 0);
      const lastInDate = inMovs.length > 0 ? inMovs[inMovs.length - 1].occurred_at.split('T')[0] : '';

      // 3. الإجمالي = أول المدة + الإضافة
      const totalQty = openingStock + addQty;

      // 4. المنصرف (Outflow)
      const outMovs = db.movements.filter(
        m => m.item_id === item.id && m.direction === 'OUT'
      );
      const outQty = Math.abs(outMovs.reduce((sum, m) => sum + m.signed_quantity, 0));
      const lastOutDate = outMovs.length > 0 ? outMovs[outMovs.length - 1].occurred_at.split('T')[0] : '';

      // 5. المتبقي (Remaining)
      const remainingQty = totalQty - outQty;

      const category = db.categories.find(c => c.id === item.category_id);
      const unit = db.units.find(u => u.id === item.base_unit_id);

      return {
        seq: index + 1,
        item,
        dept,
        categoryName: category?.name || 'عام',
        unitName: unit?.name_ar || 'قطعة',
        openingQty: openingStock,
        addQty,
        lastInDate,
        totalQty,
        outQty,
        lastOutDate,
        remainingQty
      };
    });
  }, [db]);

  // Filter rows based on search, department, and category
  const filteredRows = useMemo(() => {
    return ledgerRows.filter(row => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = row.item.name_ar.toLowerCase().includes(q);
        const matchSku = row.item.sku.toLowerCase().includes(q);
        if (!matchName && !matchSku) return false;
      }
      // Department Filter
      if (deptFilter !== 'ALL') {
        if (row.dept.key !== deptFilter) return false;
      }
      // Category Filter
      if (catFilter !== 'ALL') {
        if (row.item.category_id !== catFilter) return false;
      }
      return true;
    });
  }, [ledgerRows, searchQuery, deptFilter, catFilter]);

  // Quick department counts
  const mainCount = useMemo(() => db.items.filter(i => i.notes === 'المخزن الرئيسي' || i.sku.startsWith('MAIN-')).length, [db]);
  const orsuCount = useMemo(() => db.items.filter(i => i.notes === 'مستهلكات العمليات' || i.sku.startsWith('OR-SU-')).length, [db]);
  const ordrCount = useMemo(() => db.items.filter(i => i.notes === 'أدوية العمليات' || i.sku.startsWith('OR-DR-')).length, [db]);
  const emerCount = useMemo(() => db.items.filter(i => i.notes === 'مستلزمات وأدوية الطوارئ' || i.sku.startsWith('EMER-')).length, [db]);

  // Handle Add Item Submit
  const handleAddItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!nameAr.trim()) {
      setErrorMsg('يرجى إدخال اسم الصنف');
      return;
    }

    const nextId = db.items.length > 0 ? Math.max(...db.items.map(i => i.id)) + 1 : 1;
    const nextMovId = db.movements.length > 0 ? Math.max(...db.movements.map(m => m.id)) + 1 : 1;
    const now = new Date().toISOString();

    let prefix = 'MAIN';
    let deptName = 'المخزن الرئيسي';
    let whId = 1;
    if (targetDept === 'ORSU') { prefix = 'OR-SU'; deptName = 'مستهلكات العمليات'; whId = 4; }
    if (targetDept === 'ORDR') { prefix = 'OR-DR'; deptName = 'أدوية العمليات'; whId = 3; }
    if (targetDept === 'EMER') { prefix = 'EMER'; deptName = 'مستلزمات وأدوية الطوارئ'; whId = 2; }

    const autoSku = sku.trim() ? sku.trim().toUpperCase() : `${prefix}-${nextId.toString().padStart(3, '0')}`;

    const newItem: Item = {
      id: nextId,
      sku: autoSku,
      name_ar: nameAr.trim(),
      category_id: categoryId,
      base_unit_id: baseUnitId,
      minimum_stock: minimumStock,
      expiry_tracking: expiryTracking,
      is_active: true,
      notes: deptName,
      created_at: now,
      updated_at: now
    };

    db.items.push(newItem);

    // If opening quantity provided, register OPENING movement
    if (openingQty > 0) {
      db.movements.push({
        id: nextMovId,
        movement_no: `OP-${nextId.toString().padStart(4, '0')}`,
        movement_type: 'OPENING',
        item_id: nextId,
        warehouse_id: whId,
        quantity: openingQty,
        direction: 'IN',
        signed_quantity: openingQty,
        unit_id: baseUnitId,
        user_id: user.id,
        occurred_at: now,
        created_at: now,
        notes: `رصيد افتتاحي: ${deptName}`
      });
    }

    // Audit Log
    db.audit_logs.push({
      id: db.audit_logs.length > 0 ? Math.max(...db.audit_logs.map(a => a.id)) + 1 : 1,
      user_id: user.id,
      username: user.display_name,
      action: 'إضافة صنف للكتالوج',
      entity_type: 'بطاقة صنف',
      entity_id: newItem.id,
      after_json: JSON.stringify({ sku: newItem.sku, name: newItem.name_ar, dept: deptName }),
      occurred_at: now
    });

    saveDB(db);
    setSuccessMsg(`تمت إضافة الصنف "${nameAr}" إلى كتالوج (${deptName}) بنجاح.`);
    setShowAddItem(false);
    setNameAr('');
    setSku('');
    setOpeningQty(0);
    onRefresh();
  };

  // Handle Edit Item Submit
  const handleEditItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setErrorMsg('');
    setSuccessMsg('');

    const targetItem = db.items.find(i => i.id === editingItem.item.id);
    if (!targetItem) return;

    targetItem.name_ar = editName.trim();
    targetItem.base_unit_id = editUnitId;
    targetItem.category_id = editCategoryId;
    targetItem.minimum_stock = editMinStock;
    targetItem.updated_at = new Date().toISOString();

    // Update opening movement in item's warehouse
    const deptInfo = getItemDeptInfo(targetItem);
    const existingOpening = db.movements.find(
      m => m.item_id === targetItem.id && m.warehouse_id === deptInfo.id && m.movement_type === 'OPENING'
    );

    if (existingOpening) {
      existingOpening.quantity = editOpeningQty;
      existingOpening.signed_quantity = editOpeningQty;
      existingOpening.unit_id = editUnitId;
    } else if (editOpeningQty > 0) {
      const nextMovId = db.movements.length > 0 ? Math.max(...db.movements.map(m => m.id)) + 1 : 1;
      db.movements.push({
        id: nextMovId,
        movement_no: `OP-${targetItem.id.toString().padStart(4, '0')}`,
        movement_type: 'OPENING',
        item_id: targetItem.id,
        warehouse_id: deptInfo.id,
        quantity: editOpeningQty,
        direction: 'IN',
        signed_quantity: editOpeningQty,
        unit_id: editUnitId,
        user_id: user.id,
        occurred_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        notes: `تحديث رصيد أول المدة: ${deptInfo.name}`
      });
    }

    saveDB(db);
    setSuccessMsg(`تم تحديث بيانات الصنف "${targetItem.name_ar}" بنجاح.`);
    setEditingItem(null);
    onRefresh();
  };

  // Handle Delete Item
  const handleDeleteItem = () => {
    if (!deletingItem) return;
    setErrorMsg('');
    setSuccessMsg('');

    // Remove item and its movements
    db.movements = db.movements.filter(m => m.item_id !== deletingItem.id);
    db.items = db.items.filter(i => i.id !== deletingItem.id);

    // Audit Log
    db.audit_logs.push({
      id: db.audit_logs.length > 0 ? Math.max(...db.audit_logs.map(a => a.id)) + 1 : 1,
      user_id: user.id,
      username: user.display_name,
      action: 'حذف صنف من الكتالوج',
      entity_type: 'بطاقة صنف',
      entity_id: deletingItem.id,
      occurred_at: new Date().toISOString()
    });

    saveDB(db);
    setSuccessMsg(`تم حذف الصنف "${deletingItem.name_ar}" وكافة سجلاته بنجاح.`);
    setDeletingItem(null);
    onRefresh();
  };

  // Handle Quick Inward (+ إضافة)
  const handleQuickInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInItem || quickQty <= 0) return;

    const nextMovId = db.movements.length > 0 ? Math.max(...db.movements.map(m => m.id)) + 1 : 1;
    const nowIso = new Date(quickDate).toISOString();

    db.movements.push({
      id: nextMovId,
      movement_no: `REC-Q-${Date.now().toString().slice(-6)}`,
      movement_type: 'RECEIPT',
      item_id: quickInItem.item.id,
      warehouse_id: quickInItem.whId,
      quantity: quickQty,
      direction: 'IN',
      signed_quantity: quickQty,
      unit_id: quickInItem.item.base_unit_id,
      user_id: user.id,
      occurred_at: nowIso,
      created_at: new Date().toISOString(),
      notes: quickNotes || 'إضافة وتوريد مباشر'
    });

    saveDB(db);
    setSuccessMsg(`تم تسجيل إضافة (+${quickQty}) للصنف "${quickInItem.item.name_ar}" بتاريخ ${quickDate}.`);
    setQuickInItem(null);
    setQuickQty(1);
    setQuickNotes('');
    onRefresh();
  };

  // Handle Quick Outward (- منصرف)
  const handleQuickOutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickOutItem || quickQty <= 0) return;

    if (quickQty > quickOutItem.maxQty) {
      setErrorMsg(`خطأ: الكمية المطلوبة (${quickQty}) أكبر من الرصيد المتبقي (${quickOutItem.maxQty})!`);
      return;
    }

    const nextMovId = db.movements.length > 0 ? Math.max(...db.movements.map(m => m.id)) + 1 : 1;
    const nowIso = new Date(quickDate).toISOString();

    db.movements.push({
      id: nextMovId,
      movement_no: `ISS-Q-${Date.now().toString().slice(-6)}`,
      movement_type: 'ISSUE',
      item_id: quickOutItem.item.id,
      warehouse_id: quickOutItem.whId,
      quantity: quickQty,
      direction: 'OUT',
      signed_quantity: -quickQty,
      unit_id: quickOutItem.item.base_unit_id,
      user_id: user.id,
      occurred_at: nowIso,
      created_at: new Date().toISOString(),
      notes: quickNotes || 'صرف واستهلاك مباشر'
    });

    saveDB(db);
    setSuccessMsg(`تم تسجيل منصرف (-${quickQty}) للصنف "${quickOutItem.item.name_ar}" بتاريخ ${quickDate}.`);
    setQuickOutItem(null);
    setQuickQty(1);
    setQuickNotes('');
    onRefresh();
  };

  // Handle Add Category
  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const codeExists = db.categories.some(c => c.code.trim().toUpperCase() === catCode.trim().toUpperCase());
    if (codeExists) {
      setErrorMsg('خطأ: رمز التصنيف هذا مسجل مسبقاً.');
      return;
    }

    const newCat: Category = {
      id: db.categories.length > 0 ? Math.max(...db.categories.map(c => c.id)) + 1 : 1,
      code: catCode.trim().toUpperCase(),
      name: catName.trim(),
      is_active: true
    };

    db.categories.push(newCat);
    saveDB(db);
    setSuccessMsg(`تم إنشاء التصنيف الجديد "${catName}" بنجاح.`);
    setShowAddCategory(false);
    onRefresh();
    setCatCode('');
    setCatName('');
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'م',
      'الرمز الفريد SKU',
      'اسم الصنف الطبي',
      'القسم / المخزن',
      'التصنيف الطبي',
      'بضاعة اول المدة',
      'الاضافة',
      'تاريخ الاضافة',
      'الاجمالى',
      'المنصرف',
      'تاريخ الصرف',
      'المتبقى',
      'الوحدة',
      'حد الامان'
    ];

    const rows = filteredRows.map(r => [
      r.seq,
      `"${r.item.sku}"`,
      `"${r.item.name_ar.replace(/"/g, '""')}"`,
      `"${r.dept.name}"`,
      `"${r.categoryName}"`,
      r.openingQty,
      r.addQty || '',
      r.lastInDate || '',
      r.totalQty,
      r.outQty || '',
      r.lastOutDate || '',
      r.remainingQty,
      `"${r.unitName}"`,
      r.item.minimum_stock
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `دليل_الاصناف_والارصدة_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Reset to full seed
  const handleReloadHospitalSeed = () => {
    resetToHospitalCatalog();
    setSuccessMsg('تمت إعادة تحميل ومزامنة دليل المستشفى الشامل بنجاح (316 صنفاً موزعاً على المخازن الأربعة)!');
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Hospital className="text-blue-600 dark:text-blue-400" size={24} />
            دليل الأصناف والكتالوج الطبي الموحد
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            عرض وإدارة الكتالوج الشامل لجميع الأقسام: بضاعة أول المدة، الإضافة، الإجمالي، المنصرف، والمتبقي مع إمكانية التعديل والإضافة والحذف والتسجيل الفوري.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {user.role === 'ADMIN' && (
            <button
              onClick={handleReloadHospitalSeed}
              title="إعادة تحميل ومزامنة البيانات الطبية المعتمدة"
              className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw size={14} />
              مزامنة الكتالوج (316)
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Download size={14} />
            تصدير إلى Excel
          </button>

          {canEdit && activeSubTab === 'ITEMS' && (
            <button
              onClick={() => {
                setNameAr('');
                setSku('');
                setOpeningQty(0);
                setShowAddItem(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Plus size={16} />
              إضافة صنف جديد للكتالوج
            </button>
          )}

          {canEdit && activeSubTab === 'CATEGORIES' && (
            <button
              onClick={() => setShowAddCategory(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <FolderPlus size={16} />
              إنشاء تصنيف جديد
            </button>
          )}
        </div>
      </div>

      {/* Sub Tabs Navigation */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('ITEMS')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'ITEMS'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          دليل الأصناف والحركات ({db.items.length})
        </button>
        <button
          onClick={() => setActiveSubTab('CATEGORIES')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'CATEGORIES'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          تصنيفات المواد ({db.categories.length})
        </button>
        <button
          onClick={() => setActiveSubTab('IMPORT')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'IMPORT'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          معالج استيراد Excel الذكي
        </button>
      </div>

      {/* Action Messages */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check size={16} />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600">✕</button>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 rounded-xl text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-600">✕</button>
        </div>
      )}

      {/* --- TAB 1: MASTER ITEMS CATALOG & SPREADSHEET LEDGER --- */}
      {activeSubTab === 'ITEMS' && (
        <div className="space-y-3">
          {/* Department Selection Filter Bar (Matching Screenshot) */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">

            {/* Quick Department Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 ml-1">
                <Layers size={14} />
                تصفية حسب القسم:
              </span>
              <button
                onClick={() => setDeptFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  deptFilter === 'ALL'
                    ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                جميع الأقسام ({db.items.length})
              </button>
              <button
                onClick={() => setDeptFilter('MAIN')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  deptFilter === 'MAIN'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100'
                }`}
              >
                المخزن الرئيسي ({mainCount} صنف)
              </button>
              <button
                onClick={() => setDeptFilter('ORSU')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  deptFilter === 'ORSU'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100'
                }`}
              >
                مستهلكات العمليات ({orsuCount} صنف)
              </button>
              <button
                onClick={() => setDeptFilter('ORDR')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  deptFilter === 'ORDR'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 hover:bg-teal-100'
                }`}
              >
                أدوية العمليات ({ordrCount} صنف)
              </button>
              <button
                onClick={() => setDeptFilter('EMER')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  deptFilter === 'EMER'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
                }`}
              >
                مستلزمات الطوارئ ({emerCount} صنف)
              </button>
            </div>

            {/* Category Dropdown and Search Input */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">جميع التصنيفات الطبية</option>
                {db.categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <div className="relative flex-1 lg:w-60">
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث باسم الصنف أو SKU..."
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl pr-9 pl-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Master Unified Table Container */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden font-sans">
            <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
              <table className="w-full text-right border-collapse text-xs select-none">
                <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800/90 backdrop-blur-md text-slate-700 dark:text-slate-300 text-xs border-b border-slate-200 dark:border-slate-700 font-black">
                  <tr>
                    <th className="p-3 text-center w-10 border-l border-slate-200 dark:border-slate-700">م</th>
                    <th className="p-3 border-l border-slate-200 dark:border-slate-700 w-24">الرمز SKU</th>
                    <th className="p-3 border-l border-slate-200 dark:border-slate-700 min-w-[180px]">اسم الصنف الطبي</th>
                    <th className="p-3 border-l border-slate-200 dark:border-slate-700 w-28">القسم / الملف</th>
                    <th className="p-3 border-l border-slate-200 dark:border-slate-700 w-32">التصنيف</th>
                    <th className="p-3 text-center border-l border-slate-200 dark:border-slate-700 w-20">بضاعة أول المدة</th>
                    <th className="p-3 text-center border-l border-slate-200 dark:border-slate-700 w-20 text-blue-600 dark:text-blue-400">الإضافة</th>
                    <th className="p-3 text-center border-l border-slate-200 dark:border-slate-700 w-20 bg-slate-200/50 dark:bg-slate-800">الإجمالي</th>
                    <th className="p-3 text-center border-l border-slate-200 dark:border-slate-700 w-20 text-rose-600 dark:text-rose-400">المنصرف</th>
                    <th className="p-3 text-center border-l border-slate-200 dark:border-slate-700 w-24 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-black">المتبقي</th>
                    <th className="p-3 text-center border-l border-slate-200 dark:border-slate-700 w-16">الوحدة</th>
                    <th className="p-3 text-center border-l border-slate-200 dark:border-slate-700 w-16">حد الأمان</th>
                    {canEdit && (
                      <th className="p-3 text-center w-36">إجراءات سريعة</th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200 font-semibold">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="text-center py-16 text-slate-400">
                        لا توجد أصناف مطابقة لمعايير البحث الحالية.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr
                        key={row.item.id}
                        className="hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800"
                      >
                        {/* م */}
                        <td className="p-2.5 text-center border-l border-slate-100 dark:border-slate-800 font-mono text-slate-400 text-xs">
                          {row.seq}
                        </td>

                        {/* SKU */}
                        <td className="p-2.5 border-l border-slate-100 dark:border-slate-800 font-mono font-bold text-xs text-slate-700 dark:text-slate-300">
                          {row.item.sku}
                        </td>

                        {/* اسم الصنف الطبي */}
                        <td className="p-2.5 border-l border-slate-100 dark:border-slate-800 font-bold text-slate-900 dark:text-slate-100">
                          {row.item.name_ar}
                        </td>

                        {/* القسم / الملف */}
                        <td className="p-2.5 border-l border-slate-100 dark:border-slate-800">
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${row.dept.badgeClass}`}>
                            {row.dept.name}
                          </span>
                        </td>

                        {/* التصنيف */}
                        <td className="p-2.5 border-l border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                          {row.categoryName}
                        </td>

                        {/* بضاعة أول المدة */}
                        <td className="p-2.5 text-center border-l border-slate-100 dark:border-slate-800 font-mono font-bold">
                          {row.openingQty}
                        </td>

                        {/* الإضافة */}
                        <td className="p-2.5 text-center border-l border-slate-100 dark:border-slate-800 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {row.addQty > 0 ? (
                            <span title={`آخر إضافة: ${row.lastInDate}`}>+{row.addQty}</span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">-</span>
                          )}
                        </td>

                        {/* الإجمالي */}
                        <td className="p-2.5 text-center border-l border-slate-100 dark:border-slate-800 font-mono font-black bg-slate-50/50 dark:bg-slate-800/40">
                          {row.totalQty}
                        </td>

                        {/* المنصرف */}
                        <td className="p-2.5 text-center border-l border-slate-100 dark:border-slate-800 font-mono font-bold text-rose-600 dark:text-rose-400">
                          {row.outQty > 0 ? (
                            <span title={`آخر صرف: ${row.lastOutDate}`}>-{row.outQty}</span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">-</span>
                          )}
                        </td>

                        {/* المتبقي */}
                        <td className={`p-2.5 text-center border-l border-slate-100 dark:border-slate-800 font-mono font-black text-sm ${
                          row.remainingQty === 0
                            ? 'text-rose-500 bg-rose-50/50 dark:bg-rose-950/30'
                            : row.remainingQty <= row.item.minimum_stock
                            ? 'text-amber-500 bg-amber-50/50 dark:bg-amber-950/30'
                            : 'text-emerald-700 dark:text-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/30'
                        }`}>
                          {row.remainingQty}
                        </td>

                        {/* الوحدة */}
                        <td className="p-2.5 text-center border-l border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                          {row.unitName}
                        </td>

                        {/* حد الأمان */}
                        <td className="p-2.5 text-center border-l border-slate-100 dark:border-slate-800 font-mono text-slate-400 text-xs">
                          {row.item.minimum_stock}
                        </td>

                        {/* إجراءات سريعة */}
                        {canEdit && (
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* Quick Inward (+ وارد) */}
                              <button
                                onClick={() => {
                                  setQuickInItem({ item: row.item, whId: row.dept.id, deptName: row.dept.name });
                                  setQuickQty(1);
                                  setQuickDate(new Date().toISOString().split('T')[0]);
                                }}
                                title="إضافة وارد وتوريد كمية جديدة (+)"
                                className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded cursor-pointer transition-colors"
                              >
                                <ArrowDownRight size={15} />
                              </button>

                              {/* Quick Outward (- صرف) */}
                              <button
                                onClick={() => {
                                  setQuickOutItem({ item: row.item, whId: row.dept.id, maxQty: row.remainingQty, deptName: row.dept.name });
                                  setQuickQty(1);
                                  setQuickDate(new Date().toISOString().split('T')[0]);
                                }}
                                disabled={row.remainingQty <= 0}
                                title="تسجيل صرف واستهلاك (-)"
                                className="p-1 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded disabled:opacity-30 cursor-pointer transition-colors"
                              >
                                <ArrowUpLeft size={15} />
                              </button>

                              {/* Edit Item */}
                              <button
                                onClick={() => {
                                  setEditingItem({ item: row.item, openingQty: row.openingQty });
                                  setEditName(row.item.name_ar);
                                  setEditOpeningQty(row.openingQty);
                                  setEditUnitId(row.item.base_unit_id);
                                  setEditCategoryId(row.item.category_id);
                                  setEditMinStock(row.item.minimum_stock);
                                }}
                                title="تعديل بيانات الصنف ورصيد أول المدة"
                                className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded cursor-pointer transition-colors"
                              >
                                <Edit2 size={14} />
                              </button>

                              {/* Delete Item */}
                              <button
                                onClick={() => setDeletingItem(row.item)}
                                title="حذف الصنف من الكتالوج"
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded cursor-pointer transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex flex-wrap justify-between items-center text-xs text-slate-500 dark:text-slate-400 gap-2">
              <span>عرض <strong>{filteredRows.length}</strong> من أصل <strong>{db.items.length}</strong> صنف مسجل بالنظام</span>
              <div className="flex items-center gap-3">
                <span>إجمالي الرصيد المتبقي للأصناف المعروضة: <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{filteredRows.reduce((sum, r) => sum + r.remainingQty, 0)}</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: CATEGORIES LIST --- */}
      {activeSubTab === 'CATEGORIES' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {db.categories.map((cat) => (
            <div key={cat.id} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-2.5">
              <span className="font-mono text-xs text-slate-400 dark:text-slate-500 block uppercase font-bold">{cat.code}</span>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">{cat.name}</h3>
              <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
                <span>إجمالي الأصناف: <strong className="text-slate-800 dark:text-slate-200 font-bold">{db.items.filter(it => it.category_id === cat.id).length}</strong></span>
                <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full font-bold text-[10px]">نشط</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- TAB 3: SMART EXCEL IMPORT --- */}
      {activeSubTab === 'IMPORT' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
                <FileSpreadsheet className="text-emerald-600" size={20} />
                معالج استيراد ملفات Excel الذكي
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">استيراد وتدقيق البيانات ومطابقة الأعمدة والشذوذ تلقائياً.</p>
            </div>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 rounded-xl text-xs text-blue-800 dark:text-blue-300">
            تمت مطابقة وتضمين كامل بيانات المخازن الأربعة الـ 316 صنفاً في الدليل الموحد مع أرصدتها الافتتاحية بدقة متناهية.
          </div>
        </div>
      )}

      {/* --- MODAL 1: ADD ITEM --- */}
      {showAddItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 p-4 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                إضافة صنف جديد لدليل الأصناف
              </h3>
              <button onClick={() => setShowAddItem(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddItemSubmit} className="p-5 space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">اسم الصنف الطبي</label>
                <input
                  type="text"
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder="مثال: كانيولا زرقاء 22G أو جلوكوز 5%..."
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-500 font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">القسم / المستودع التابع له</label>
                <select
                  value={targetDept}
                  onChange={(e) => setTargetDept(e.target.value as any)}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 text-xs font-bold"
                >
                  <option value="MAIN">المخزن الرئيسي للمجمع (MAIN)</option>
                  <option value="ORSU">مستهلكات العمليات (ORSU)</option>
                  <option value="ORDR">أدوية العمليات الجراحية (ORDR)</option>
                  <option value="EMER">مستلزمات وأدوية الطوارئ (EMER)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">بضاعة أول المدة</label>
                  <input
                    type="number"
                    min="0"
                    value={openingQty}
                    onChange={(e) => setOpeningQty(Number(e.target.value))}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">الوحدة الافتراضية</label>
                  <select
                    value={baseUnitId}
                    onChange={(e) => setBaseUnitId(Number(e.target.value))}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 text-xs"
                  >
                    {db.units.map(u => (
                      <option key={u.id} value={u.id}>{u.name_ar}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">التصنيف الطبي</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(Number(e.target.value))}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 text-xs"
                  >
                    {db.categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">حد الأمان (Minimum)</label>
                  <input
                    type="number"
                    min="1"
                    value={minimumStock}
                    onChange={(e) => setMinimumStock(Number(e.target.value))}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-150 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddItem(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer"
                >
                  حفظ الصنف بالكتالوج
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: EDIT ITEM --- */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 p-4 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                تعديل الصنف: {editingItem.item.name_ar} ({editingItem.item.sku})
              </h3>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditItemSubmit} className="p-5 space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">اسم الصنف</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 text-xs font-bold focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">بضاعة أول المدة</label>
                  <input
                    type="number"
                    min="0"
                    value={editOpeningQty}
                    onChange={(e) => setEditOpeningQty(Number(e.target.value))}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">الوحدة</label>
                  <select
                    value={editUnitId}
                    onChange={(e) => setEditUnitId(Number(e.target.value))}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 text-xs"
                  >
                    {db.units.map(u => (
                      <option key={u.id} value={u.id}>{u.name_ar}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">التصنيف الطبي</label>
                  <select
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(Number(e.target.value))}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 text-xs"
                  >
                    {db.categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">حد الأمان (Minimum)</label>
                  <input
                    type="number"
                    min="1"
                    value={editMinStock}
                    onChange={(e) => setEditMinStock(Number(e.target.value))}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-150 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: DELETE CONFIRMATION --- */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-5 space-y-4">
            <h3 className="font-bold text-rose-600 text-base flex items-center gap-2">
              <Trash2 size={20} />
              تأكيد حذف الصنف من الكتالوج
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              هل أنت متأكد من حذف الصنف <strong className="text-slate-900 dark:text-slate-100 font-bold">"{deletingItem.name_ar}" ({deletingItem.sku})</strong> نهائياً؟ سيتم إلغاء كافة حركاته المخزنية وسجلاته.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                نعم، تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 4: QUICK INWARD (+ إضافة) --- */}
      {quickInItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-emerald-50 dark:bg-emerald-950/60 p-4 border-b border-emerald-150 flex justify-between items-center">
              <h3 className="font-bold text-emerald-800 dark:text-emerald-300 text-sm flex items-center gap-1.5">
                <ArrowDownRight size={18} />
                تسجيل إضافة وارد: {quickInItem.item.name_ar}
              </h3>
              <button onClick={() => setQuickInItem(null)} className="text-emerald-700">✕</button>
            </div>

            <form onSubmit={handleQuickInSubmit} className="p-5 space-y-3.5">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg text-xs flex justify-between items-center">
                <span className="text-slate-500">القسم المستهدف:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{quickInItem.deptName}</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">الكمية المضافة (الوارد)</label>
                <input
                  type="number"
                  min="1"
                  value={quickQty}
                  onChange={(e) => setQuickQty(Number(e.target.value))}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 text-sm font-mono font-black text-center"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">تاريخ الإضافة</label>
                <input
                  type="date"
                  value={quickDate}
                  onChange={(e) => setQuickDate(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 text-xs font-mono text-center"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">ملاحظات / رقم الإذن (اختياري)</label>
                <input
                  type="text"
                  value={quickNotes}
                  onChange={(e) => setQuickNotes(e.target.value)}
                  placeholder="رقم الفاتورة أو إذن الاستلام..."
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => setQuickInItem(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer"
                >
                  تأكيد الإضافة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 5: QUICK OUTWARD (- صرف) --- */}
      {quickOutItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-rose-50 dark:bg-rose-950/60 p-4 border-b border-rose-150 flex justify-between items-center">
              <h3 className="font-bold text-rose-800 dark:text-rose-300 text-sm flex items-center gap-1.5">
                <ArrowUpLeft size={18} />
                تسجيل منصرف: {quickOutItem.item.name_ar}
              </h3>
              <button onClick={() => setQuickOutItem(null)} className="text-rose-700">✕</button>
            </div>

            <form onSubmit={handleQuickOutSubmit} className="p-5 space-y-3.5">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg text-xs flex justify-between items-center">
                <span className="text-slate-500">الرصيد المتاح للصرف:</span>
                <span className="font-mono font-bold text-emerald-600 text-sm">{quickOutItem.maxQty}</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">الكمية المنصرفة</label>
                <input
                  type="number"
                  min="1"
                  max={quickOutItem.maxQty}
                  value={quickQty}
                  onChange={(e) => setQuickQty(Number(e.target.value))}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 text-sm font-mono font-black text-center text-rose-600"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">تاريخ الصرف</label>
                <input
                  type="date"
                  value={quickDate}
                  onChange={(e) => setQuickDate(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 text-xs font-mono text-center"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">الجهة / المريض / ملاحظات</label>
                <input
                  type="text"
                  value={quickNotes}
                  onChange={(e) => setQuickNotes(e.target.value)}
                  placeholder="اسم الطبيب، القسم، أو المريض..."
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => setQuickOutItem(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer"
                >
                  تأكيد الصرف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 6: ADD CATEGORY --- */}
      {showAddCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">إنشاء تصنيف جديد</h3>
              <button onClick={() => setShowAddCategory(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddCategorySubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">رمز التصنيف (Code)</label>
                <input
                  type="text"
                  value={catCode}
                  onChange={(e) => setCatCode(e.target.value)}
                  placeholder="مثال: ANESTH"
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 text-xs font-mono uppercase"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">اسم التصنيف بالعربية</label>
                <input
                  type="text"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="مثال: أدوية التخدير والإنعاش"
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 text-xs font-bold"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddCategory(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer"
                >
                  إنشاء التصنيف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
