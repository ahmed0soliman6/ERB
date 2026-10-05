import React, { useState, useMemo } from 'react';
import { 
  Plus, FolderPlus, Upload, ShieldAlert, Check, FileSpreadsheet, 
  ChevronRight, Search, RefreshCw, Layers, Hospital, Download, 
  Edit2, Trash2, ArrowDownRight, ArrowUpLeft, X, AlertCircle,
  LayoutGrid, Table as TableIcon, Sparkles, Filter
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
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARDS'>('TABLE');
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
  const [openingQty, setOpeningQty] = useState<number | ''>('');
  const [categoryId, setCategoryId] = useState<number>(1);
  const [baseUnitId, setBaseUnitId] = useState<number>(1);
  const [minimumStock, setMinimumStock] = useState<number | ''>('');
  const [expiryTracking, setExpiryTracking] = useState(true);

  // Form State for Edit Item
  const [editName, setEditName] = useState('');
  const [editOpeningQty, setEditOpeningQty] = useState<number | ''>('');
  const [editUnitId, setEditUnitId] = useState<number>(1);
  const [editMinStock, setEditMinStock] = useState<number | ''>('');
  const [editCategoryId, setEditCategoryId] = useState<number>(1);

  // Quick Movement State (+ In / - Out)
  const [quickQty, setQuickQty] = useState<number | ''>('');
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
      return { id: 1, key: 'MAIN', name: 'المخزن الرئيسي', badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' };
    }
    if (item.notes === 'مستهلكات العمليات' || item.sku.startsWith('OR-SU-')) {
      return { id: 4, key: 'ORSU', name: 'مستهلكات العمليات', badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30' };
    }
    if (item.notes === 'أدوية العمليات' || item.sku.startsWith('OR-DR-')) {
      return { id: 3, key: 'ORDR', name: 'أدوية العمليات', badgeClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30' };
    }
    if (item.notes === 'مستلزمات وأدوية الطوارئ' || item.sku.startsWith('EMER-')) {
      return { id: 2, key: 'EMER', name: 'طوارئ واستقبال', badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' };
    }
    return { id: 1, key: 'MAIN', name: 'عام', badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30' };
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
        const matchCat = row.categoryName.toLowerCase().includes(q);
        if (!matchName && !matchSku && !matchCat) return false;
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

  // Count items per department for the filter pills
  const mainCount = useMemo(() => db.items.filter(i => i.notes === 'المخزن الرئيسي' || i.sku.startsWith('MAIN-')).length, [db]);
  const orsuCount = useMemo(() => db.items.filter(i => i.notes === 'مستهلكات العمليات' || i.sku.startsWith('OR-SU-')).length, [db]);
  const ordrCount = useMemo(() => db.items.filter(i => i.notes === 'أدوية العمليات' || i.sku.startsWith('OR-DR-')).length, [db]);
  const emerCount = useMemo(() => db.items.filter(i => i.notes === 'مستلزمات وأدوية الطوارئ' || i.sku.startsWith('EMER-')).length, [db]);

  // Handle Add Item
  const handleAddItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) {
      setErrorMsg('يرجى إدخال اسم الصنف الطبي.');
      return;
    }

    const nextId = db.items.length > 0 ? Math.max(...db.items.map(i => i.id)) + 1 : 1;
    let deptPrefix = 'MAIN-';
    let deptName = 'المخزن الرئيسي';
    let targetWhId = 1;

    if (targetDept === 'ORSU') {
      deptPrefix = 'OR-SU-';
      deptName = 'مستهلكات العمليات';
      targetWhId = 4;
    } else if (targetDept === 'ORDR') {
      deptPrefix = 'OR-DR-';
      deptName = 'أدوية العمليات';
      targetWhId = 3;
    } else if (targetDept === 'EMER') {
      deptPrefix = 'EMER-';
      deptName = 'مستلزمات وأدوية الطوارئ';
      targetWhId = 2;
    }

    const autoSku = sku.trim() ? sku.trim() : `${deptPrefix}${nextId.toString().padStart(4, '0')}`;

    const newItem: Item = {
      id: nextId,
      sku: autoSku,
      name_ar: nameAr.trim(),
      category_id: categoryId,
      base_unit_id: baseUnitId,
      minimum_stock: Number(minimumStock) || 20,
      expiry_tracking: expiryTracking,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: deptName
    };

    db.items.push(newItem);

    // If opening quantity provided, register OPENING movement
    const opQtyNum = Number(openingQty) || 0;
    if (opQtyNum > 0) {
      const nextMovId = db.movements.length > 0 ? Math.max(...db.movements.map(m => m.id)) + 1 : 1;
      db.movements.push({
        id: nextMovId,
        movement_no: `OP-${nextId.toString().padStart(4, '0')}`,
        movement_type: 'OPENING',
        item_id: nextId,
        warehouse_id: targetWhId,
        direction: 'IN',
        quantity: opQtyNum,
        signed_quantity: opQtyNum,
        unit_id: baseUnitId,
        user_id: user.id,
        occurred_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        notes: `رصيد أول المدة - ${deptName}`
      });
    }

    saveDB(db);
    setShowAddItem(false);
    setNameAr('');
    setSku('');
    setOpeningQty('');
    setMinimumStock('');
    setSuccessMsg(`تمت إضافة الصنف "${newItem.name_ar}" بنجاح وتعيينه لـ (${deptName}).`);
    onRefresh();
  };

  // Handle Edit Item
  const handleEditItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editName.trim()) return;

    const item = db.items.find(i => i.id === editingItem.item.id);
    if (item) {
      item.name_ar = editName.trim();
      item.category_id = editCategoryId;
      item.base_unit_id = editUnitId;
      item.minimum_stock = Number(editMinStock) || 20;
      item.updated_at = new Date().toISOString();

      // Update or create opening movement if changed
      const dept = getItemDeptInfo(item);
      const whId = dept.id;
      const openingMov = db.movements.find(m => m.item_id === item.id && m.movement_type === 'OPENING');
      const editOpNum = Number(editOpeningQty) || 0;

      if (openingMov) {
        openingMov.quantity = editOpNum;
        openingMov.signed_quantity = editOpNum;
      } else if (editOpNum > 0) {
        const nextMovId = db.movements.length > 0 ? Math.max(...db.movements.map(m => m.id)) + 1 : 1;
        db.movements.push({
          id: nextMovId,
          movement_no: `OP-${item.id.toString().padStart(4, '0')}`,
          movement_type: 'OPENING',
          item_id: item.id,
          warehouse_id: whId,
          direction: 'IN',
          quantity: editOpNum,
          signed_quantity: editOpNum,
          unit_id: item.base_unit_id,
          user_id: user.id,
          occurred_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          notes: `رصيد أول المدة المعدل - ${dept.name}`
        });
      }

      saveDB(db);
      setEditingItem(null);
      setSuccessMsg(`تم تحديث بيانات الصنف "${item.name_ar}" بنجاح.`);
      onRefresh();
    }
  };

  // Handle Delete Item
  const handleDeleteItem = () => {
    if (!deletingItem) return;
    const itemId = deletingItem.id;
    const itemName = deletingItem.name_ar;

    // Delete item from items table
    db.items = db.items.filter(i => i.id !== itemId);
    // Remove all associated movements to maintain ledger consistency
    db.movements = db.movements.filter(m => m.item_id !== itemId);

    saveDB(db);
    setDeletingItem(null);
    setSuccessMsg(`تم حذف الصنف "${itemName}" وسجلاته بنجاح.`);
    onRefresh();
  };

  // Handle Quick Inward (+ إضافة)
  const handleQuickInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = Number(quickQty);
    if (!quickInItem || qtyNum <= 0) return;

    const nextMovId = db.movements.length > 0 ? Math.max(...db.movements.map(m => m.id)) + 1 : 1;
    const dateStr = quickDate ? new Date(quickDate).toISOString() : new Date().toISOString();

    db.movements.push({
      id: nextMovId,
      movement_no: `IN-${nextMovId.toString().padStart(5, '0')}`,
      movement_type: 'RECEIPT',
      item_id: quickInItem.item.id,
      warehouse_id: quickInItem.whId,
      direction: 'IN',
      quantity: qtyNum,
      signed_quantity: qtyNum,
      unit_id: quickInItem.item.base_unit_id,
      user_id: user.id,
      occurred_at: dateStr,
      created_at: new Date().toISOString(),
      notes: quickNotes.trim() ? `إضافة سريعة: ${quickNotes.trim()}` : `إضافة وارد مباشر - ${quickInItem.deptName}`
    });

    saveDB(db);
    setQuickInItem(null);
    setQuickQty('');
    setQuickNotes('');
    setSuccessMsg(`تمت إضافة (+${qtyNum}) إلى رصيد "${quickInItem.item.name_ar}" بنجاح.`);
    onRefresh();
  };

  // Handle Quick Outward (- صرف)
  const handleQuickOutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = Number(quickQty);
    if (!quickOutItem || qtyNum <= 0) return;

    if (qtyNum > quickOutItem.maxQty) {
      setErrorMsg(`خطأ: الكمية المطلوبة (${qtyNum}) تتجاوز الرصيد المتبقي المتاح (${quickOutItem.maxQty}).`);
      return;
    }

    const nextMovId = db.movements.length > 0 ? Math.max(...db.movements.map(m => m.id)) + 1 : 1;
    const dateStr = quickDate ? new Date(quickDate).toISOString() : new Date().toISOString();

    db.movements.push({
      id: nextMovId,
      movement_no: `OUT-${nextMovId.toString().padStart(5, '0')}`,
      movement_type: 'ISSUE',
      item_id: quickOutItem.item.id,
      warehouse_id: quickOutItem.whId,
      direction: 'OUT',
      quantity: qtyNum,
      signed_quantity: -qtyNum,
      unit_id: quickOutItem.item.base_unit_id,
      user_id: user.id,
      occurred_at: dateStr,
      created_at: new Date().toISOString(),
      notes: quickNotes.trim() ? `صرف سريع: ${quickNotes.trim()}` : `صرف مباشر - ${quickOutItem.deptName}`
    });

    saveDB(db);
    setQuickOutItem(null);
    setQuickQty('');
    setQuickNotes('');
    setSuccessMsg(`تم تسجيل صرف (-${qtyNum}) من رصيد "${quickOutItem.item.name_ar}" بنجاح.`);
    onRefresh();
  };

  // Handle Add Category
  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim() || !catCode.trim()) return;

    const nextId = db.categories.length > 0 ? Math.max(...db.categories.map(c => c.id)) + 1 : 1;
    const newCat: Category = {
      id: nextId,
      code: catCode.trim().toUpperCase(),
      name: catName.trim(),
      is_active: true
    };

    db.categories.push(newCat);
    saveDB(db);
    setShowAddCategory(false);
    setCatCode('');
    setCatName('');
    setSuccessMsg(`تم إنشاء التصنيف الطبي الجديد "${newCat.name}" بنجاح.`);
    onRefresh();
  };

  // Export to Excel / CSV
  const handleExportCSV = () => {
    const headers = [
      'م',
      'الرمز SKU',
      'اسم الصنف الطبي',
      'القسم',
      'التصنيف',
      'بضاعة اول المدة',
      'الاضافة',
      'تاريخ اخر اضافة',
      'الاجمالي',
      'المنصرف',
      'تاريخ اخر صرف',
      'المتبقي',
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
    <div className="space-y-4 max-w-full overflow-x-hidden">
      {/* View Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Hospital className="text-blue-600 dark:text-blue-400 shrink-0" size={24} />
            دليل الأصناف والكتالوج الطبي الموحد
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed">
            عرض وإدارة الكتالوج الشامل لجميع الأقسام: بضاعة أول المدة، الإضافة، الإجمالي، المنصرف، والمتبقي مع إمكانية التعديل والإضافة والحذف والتسجيل الفوري.
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle: Table / Cards */}
          {activeSubTab === 'ITEMS' && (
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setViewMode('TABLE')}
                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === 'TABLE' 
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
                title="عرض الجدول الشامل"
              >
                <TableIcon size={14} />
                <span className="hidden sm:inline">جدول</span>
              </button>
              <button
                onClick={() => setViewMode('CARDS')}
                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === 'CARDS' 
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
                title="عرض البطاقات الذكية (مناسب للشاشات الصغيرة)"
              >
                <LayoutGrid size={14} />
                <span className="hidden sm:inline">بطاقات</span>
              </button>
            </div>
          )}

          {user.role === 'ADMIN' && (
            <button 
              onClick={handleReloadHospitalSeed}
              title="إعادة تحميل ومزامنة البيانات الطبية المعتمدة"
              className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <RefreshCw size={14} />
              <span className="hidden sm:inline">مزامنة</span> (316)
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <Download size={14} />
            <span className="hidden sm:inline">تصدير</span> Excel
          </button>

          {canEdit && activeSubTab === 'ITEMS' && (
            <button 
              onClick={() => {
                setNameAr('');
                setSku('');
                setOpeningQty('');
                setMinimumStock('');
                setShowAddItem(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Plus size={16} />
              إضافة صنف جديد
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
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('ITEMS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'ITEMS' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          دليل الأصناف والحركات ({db.items.length})
        </button>
        <button
          onClick={() => setActiveSubTab('CATEGORIES')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'CATEGORIES' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          تصنيفات المواد ({db.categories.length})
        </button>
        <button
          onClick={() => setActiveSubTab('IMPORT')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <Check size={16} />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-800 cursor-pointer">✕</button>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 rounded-xl text-xs font-bold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-600 hover:text-rose-800 cursor-pointer">✕</button>
        </div>
      )}

      {/* --- TAB 1: MASTER ITEMS CATALOG & SPREADSHEET LEDGER --- */}
      {activeSubTab === 'ITEMS' && (
        <div className="space-y-4">
          {/* Department Selection Filter Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            
            {/* Quick Department Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 ml-1">
                <Layers size={14} />
                تصفية:
              </span>
              <button
                onClick={() => setDeptFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  deptFilter === 'ALL'
                    ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                الكل ({db.items.length})
              </button>
              <button
                onClick={() => setDeptFilter('MAIN')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  deptFilter === 'MAIN'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100'
                }`}
              >
                الرئيسي ({mainCount})
              </button>
              <button
                onClick={() => setDeptFilter('ORSU')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  deptFilter === 'ORSU'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100'
                }`}
              >
                مستهلكات العمليات ({orsuCount})
              </button>
              <button
                onClick={() => setDeptFilter('ORDR')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  deptFilter === 'ORDR'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 hover:bg-teal-100'
                }`}
              >
                أدوية العمليات ({ordrCount})
              </button>
              <button
                onClick={() => setDeptFilter('EMER')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  deptFilter === 'EMER'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
                }`}
              >
                الطوارئ ({emerCount})
              </button>
            </div>

            {/* Category Dropdown and Search Input */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">جميع التصنيفات</option>
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

          {/* VIEW MODE 1: RESPONSIVE CARDS VIEW (Great for Mobile and Compact Screens) */}
          {viewMode === 'CARDS' && (
            <div className="space-y-3">
              {filteredRows.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-sm">
                  لا توجد أصناف مطابقة لمعايير البحث الحالية.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {filteredRows.map((row) => (
                    <div 
                      key={row.item.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all space-y-3"
                    >
                      {/* Top bar */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-slate-400 font-bold">#{row.seq}</span>
                            <span className="font-mono text-xs font-black text-blue-600 dark:text-blue-400">{row.item.sku}</span>
                          </div>
                          <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-0.5">{row.item.name_ar}</h4>
                          <span className="text-[11px] text-slate-400 block">{row.categoryName}</span>
                        </div>
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${row.dept.badgeClass}`}>
                          {row.dept.name}
                        </span>
                      </div>

                      {/* Stock Figures Grid */}
                      <div className="grid grid-cols-4 gap-1.5 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-center text-xs font-mono">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-sans">أول المدة</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">{row.openingQty}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-blue-500 block font-sans">وارد (+)</span>
                          <span className="font-bold text-blue-600 dark:text-blue-400">{row.addQty}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-rose-500 block font-sans">منصرف (-)</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400">{row.outQty}</span>
                        </div>
                        <div className="border-r border-slate-200 dark:border-slate-700 pr-1">
                          <span className="text-[10px] text-emerald-600 block font-sans font-bold">المتبقي</span>
                          <span className={`font-black text-sm ${
                            row.remainingQty === 0 
                              ? 'text-rose-600' 
                              : row.remainingQty <= row.item.minimum_stock 
                              ? 'text-amber-500' 
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {row.remainingQty}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Action Bar */}
                      {canEdit && (
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 gap-1.5">
                          <div className="flex items-center gap-1.5">
                            {/* Quick In */}
                            <button
                              onClick={() => {
                                setQuickInItem({ item: row.item, whId: row.dept.id, deptName: row.dept.name });
                                setQuickQty('');
                                setQuickDate(new Date().toISOString().split('T')[0]);
                              }}
                              className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white rounded-lg text-xs font-bold border border-emerald-200 dark:border-emerald-800 transition-all flex items-center gap-1 cursor-pointer"
                              title="تسجيل وارد سريع (+)"
                            >
                              <ArrowDownRight size={13} />
                              <span>وارد</span>
                            </button>

                            {/* Quick Out */}
                            <button
                              onClick={() => {
                                setQuickOutItem({ item: row.item, whId: row.dept.id, maxQty: row.remainingQty, deptName: row.dept.name });
                                setQuickQty('');
                                setQuickDate(new Date().toISOString().split('T')[0]);
                              }}
                              disabled={row.remainingQty <= 0}
                              className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-600 text-rose-700 dark:text-rose-300 hover:text-white rounded-lg text-xs font-bold border border-rose-200 dark:border-rose-800 disabled:opacity-40 transition-all flex items-center gap-1 cursor-pointer"
                              title="تسجيل صرف سريع (-)"
                            >
                              <ArrowUpLeft size={13} />
                              <span>صرف</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Edit */}
                            <button
                              onClick={() => {
                                setEditingItem({ item: row.item, openingQty: row.openingQty });
                                setEditName(row.item.name_ar);
                                setEditOpeningQty(row.openingQty);
                                setEditUnitId(row.item.base_unit_id);
                                setEditCategoryId(row.item.category_id);
                                setEditMinStock(row.item.minimum_stock);
                              }}
                              className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-900/60 transition-all cursor-pointer"
                              title="تعديل الصنف"
                            >
                              <Edit2 size={14} />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => setDeletingItem(row.item)}
                              className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white rounded-lg border border-rose-200 dark:border-rose-900/60 transition-all cursor-pointer"
                              title="حذف الصنف نهائياً"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VIEW MODE 2: MASTER UNIFIED FULL TABLE */}
          {viewMode === 'TABLE' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden font-sans">
              <div className="overflow-x-auto w-full">
                <table className="min-w-[1100px] w-full text-right border-collapse text-xs select-none">
                  <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 text-xs border-b border-slate-200 dark:border-slate-700 font-black sticky top-0 z-20">
                    <tr>
                      <th className="p-3 text-center w-10 border-l border-slate-200 dark:border-slate-700">م</th>
                      <th className="p-3 border-l border-slate-200 dark:border-slate-700 w-24">الرمز SKU</th>
                      <th className="p-3 border-l border-slate-200 dark:border-slate-700 min-w-[200px]">اسم الصنف الطبي</th>
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
                        <th className="p-3 text-center w-48 min-w-[180px] bg-slate-200/80 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
                          الإجراءات والتحكم
                        </th>
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

                          {/* إجراءات سريعة - Visible without clipping */}
                          {canEdit && (
                            <td className="p-2 text-center bg-slate-50/70 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700">
                              <div className="flex items-center justify-center gap-1">
                                {/* Quick Inward (+ وارد) */}
                                <button
                                  onClick={() => {
                                    setQuickInItem({ item: row.item, whId: row.dept.id, deptName: row.dept.name });
                                    setQuickQty('');
                                    setQuickDate(new Date().toISOString().split('T')[0]);
                                  }}
                                  title="إضافة وارد وتوريد كمية جديدة (+)"
                                  className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/80 rounded-lg cursor-pointer transition-colors border border-emerald-200 dark:border-emerald-800"
                                >
                                  <ArrowDownRight size={15} />
                                </button>

                                {/* Quick Outward (- صرف) */}
                                <button
                                  onClick={() => {
                                    setQuickOutItem({ item: row.item, whId: row.dept.id, maxQty: row.remainingQty, deptName: row.dept.name });
                                    setQuickQty('');
                                    setQuickDate(new Date().toISOString().split('T')[0]);
                                  }}
                                  disabled={row.remainingQty <= 0}
                                  title="تسجيل صرف واستهلاك (-)"
                                  className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/80 rounded-lg disabled:opacity-30 cursor-pointer transition-colors border border-rose-200 dark:border-rose-800"
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
                                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/80 rounded-lg cursor-pointer transition-colors border border-blue-200 dark:border-blue-800"
                                >
                                  <Edit2 size={14} />
                                </button>

                                {/* Delete Item */}
                                <button
                                  onClick={() => setDeletingItem(row.item)}
                                  title="حذف الصنف من الكتالوج نهائياً"
                                  className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white rounded-lg cursor-pointer transition-all border border-rose-300 dark:border-rose-800 shadow-xs"
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
          )}
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

      {/* --- TAB 3: EXCEL IMPORT WIZARD SIMULATOR --- */}
      {activeSubTab === 'IMPORT' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <FileSpreadsheet className="text-emerald-600" size={20} />
                معالج استيراد ملفات Excel الذكي
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                استيراد كتالوج الأصناف ورصيد أول المدة مع المعالجة الذكية للتكرار والأخطاء.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-900/60">
                الخطوة {importStep} من 3
              </span>
            </div>
          </div>

          {importStep === 1 && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 text-center space-y-3 bg-slate-50/50 dark:bg-slate-800/30">
                <Upload size={36} className="mx-auto text-slate-400" />
                <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm">اختر ملف Excel (.xlsx / .csv)</h4>
                <p className="text-xs text-slate-400">الملف المحدد حالياً: <strong className="text-blue-600">{selectedSheet}</strong></p>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setImportStep(2)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <span>متابعة مطابقة الأعمدة</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {importStep === 2 && (
            <div className="space-y-4">
              <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300">مطابقة أعمدة Excel مع حقول النظام:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(mappedColumns).map(([col, field]) => (
                  <div key={col} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{col}</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">⟵ {field}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between pt-3">
                <button
                  onClick={() => setImportStep(1)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  السابق
                </button>
                <button
                  onClick={() => setImportStep(3)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <span>فحص الأخطاء والتكرار</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {importStep === 3 && (
            <div className="space-y-4">
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-2">
                <ShieldAlert size={18} />
                <span>تم اكتشاف (4) حالات غير نمطية تحتاج إلى توجيه:</span>
              </div>

              <div className="space-y-2.5">
                {importAnomalies.map(anom => (
                  <div key={anom.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{anom.item}</span>
                      <span className="text-[10px] text-slate-400 block">{anom.text}</span>
                    </div>
                    <select className="border border-slate-300 dark:border-slate-600 rounded-lg p-1.5 text-xs bg-white dark:bg-slate-800">
                      {anom.action_opts.map((opt: string) => (
                        <option key={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-3">
                <button
                  onClick={() => setImportStep(2)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  السابق
                </button>
                <button
                  onClick={() => {
                    setSuccessMsg('تم استيراد ومعالجة ملف Excel بنجاح.');
                    setActiveSubTab('ITEMS');
                    setImportStep(1);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <Check size={16} />
                  <span>تأكيد واعتماد الاستيراد</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- MODAL 1: ADD ITEM --- */}
      {showAddItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Plus size={18} />
                إضافة صنف جديد لكتالوج المجمع الطبي
              </h3>
              <button onClick={() => setShowAddItem(false)} className="text-blue-100 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddItemSubmit} className="p-5 space-y-4 overflow-y-auto">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">القسم المستهدف / المخزن المخصص</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetDept('MAIN')}
                    className={`p-2.5 rounded-xl text-xs font-bold border transition-all text-right cursor-pointer ${
                      targetDept === 'MAIN' ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    🏢 المخزن الرئيسي
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetDept('ORSU')}
                    className={`p-2.5 rounded-xl text-xs font-bold border transition-all text-right cursor-pointer ${
                      targetDept === 'ORSU' ? 'border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    🩺 مستهلكات العمليات
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetDept('ORDR')}
                    className={`p-2.5 rounded-xl text-xs font-bold border transition-all text-right cursor-pointer ${
                      targetDept === 'ORDR' ? 'border-teal-600 bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    💊 أدوية العمليات
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetDept('EMER')}
                    className={`p-2.5 rounded-xl text-xs font-bold border transition-all text-right cursor-pointer ${
                      targetDept === 'EMER' ? 'border-amber-600 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    🚑 مستلزمات الطوارئ
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">اسم الصنف الطبي بالعربية *</label>
                <input
                  type="text"
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder="مثال: شاش معقم مقاس 10*10 سم"
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">الرمز الفريد SKU (اختياري)</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="توليد تلقائي..."
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">التصنيف الطبي</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(Number(e.target.value))}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2 text-xs"
                  >
                    {db.categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">بضاعة أول المدة</label>
                  <input
                    type="number"
                    min="0"
                    value={openingQty}
                    placeholder="الكمية"
                    onChange={(e) => setOpeningQty(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2 text-xs font-mono font-bold text-center"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">الوحدة الأساسية</label>
                  <select
                    value={baseUnitId}
                    onChange={(e) => setBaseUnitId(Number(e.target.value))}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2 text-xs"
                  >
                    {db.units.map(u => (
                      <option key={u.id} value={u.id}>{u.name_ar} ({u.code})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">حد الأمان (الطلب)</label>
                  <input
                    type="number"
                    min="1"
                    value={minimumStock}
                    placeholder="20"
                    onChange={(e) => setMinimumStock(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2 text-xs font-mono text-center"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddItem(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                >
                  حفظ وإضافة الصنف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: EDIT ITEM --- */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Edit2 size={18} />
                تعديل بيانات الصنف: {editingItem.item.sku}
              </h3>
              <button onClick={() => setEditingItem(null)} className="text-blue-100 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditItemSubmit} className="p-5 space-y-4 overflow-y-auto">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">اسم الصنف الطبي بالعربية *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2.5 text-xs font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">التصنيف</label>
                  <select
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(Number(e.target.value))}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2 text-xs"
                  >
                    {db.categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">الوحدة</label>
                  <select
                    value={editUnitId}
                    onChange={(e) => setEditUnitId(Number(e.target.value))}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2 text-xs"
                  >
                    {db.units.map(u => (
                      <option key={u.id} value={u.id}>{u.name_ar}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">بضاعة أول المدة</label>
                  <input
                    type="number"
                    min="0"
                    value={editOpeningQty}
                    placeholder="0"
                    onChange={(e) => setEditOpeningQty(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2 text-xs font-mono font-bold text-center"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">حد الأمان (Minimum)</label>
                  <input
                    type="number"
                    min="1"
                    value={editMinStock}
                    placeholder="20"
                    onChange={(e) => setEditMinStock(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2 text-xs font-mono text-center"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
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
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm"
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
            <div className="bg-emerald-50 dark:bg-emerald-950/60 p-4 border-b border-emerald-100 dark:border-emerald-900/60 flex justify-between items-center">
              <h3 className="font-bold text-emerald-800 dark:text-emerald-300 text-sm flex items-center gap-1.5">
                <ArrowDownRight size={18} />
                تسجيل إضافة وارد: {quickInItem.item.name_ar}
              </h3>
              <button onClick={() => setQuickInItem(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleQuickInSubmit} className="p-5 space-y-3.5">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl text-xs flex justify-between items-center">
                <span className="text-slate-500">القسم المستهدف:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{quickInItem.deptName}</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">الكمية المضافة (الوارد)</label>
                <input
                  type="number"
                  min="1"
                  value={quickQty}
                  placeholder="الكمية"
                  onChange={(e) => setQuickQty(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2.5 text-sm font-mono font-black text-center"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">تاريخ الإضافة</label>
                <input
                  type="date"
                  value={quickDate}
                  onChange={(e) => setQuickDate(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2 text-xs font-mono text-center"
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
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setQuickInItem(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
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
            <div className="bg-rose-50 dark:bg-rose-950/60 p-4 border-b border-rose-100 dark:border-rose-900/60 flex justify-between items-center">
              <h3 className="font-bold text-rose-800 dark:text-rose-300 text-sm flex items-center gap-1.5">
                <ArrowUpLeft size={18} />
                تسجيل منصرف: {quickOutItem.item.name_ar}
              </h3>
              <button onClick={() => setQuickOutItem(null)} className="text-rose-700 hover:text-rose-900 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleQuickOutSubmit} className="p-5 space-y-3.5">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl text-xs flex justify-between items-center">
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
                  placeholder="الكمية"
                  onChange={(e) => setQuickQty(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2.5 text-sm font-mono font-black text-center text-rose-600"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">تاريخ الصرف</label>
                <input
                  type="date"
                  value={quickDate}
                  onChange={(e) => setQuickDate(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2 text-xs font-mono text-center"
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
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setQuickOutItem(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
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
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2 text-xs font-mono uppercase"
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
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2 text-xs font-bold"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddCategory(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
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
