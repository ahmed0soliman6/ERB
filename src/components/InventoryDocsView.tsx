import React, { useState, useMemo } from 'react';
import { 
  Plus, Trash, Check, Ban, FileText, Eye, AlertCircle, Building2, 
  Edit2, Trash2, X, PlusCircle, Search, Sparkles, CheckCircle2,
  Phone, MapPin, ArrowRightLeft, Send, Stethoscope, PackageCheck,
  PenTool, Warehouse as WarehouseIcon
} from 'lucide-react';
import { DBSchema, Document, Supplier, approveDocument, voidDocument, saveDB } from '../data/db';

interface InventoryDocsViewProps {
  db: DBSchema;
  user: any;
  onRefresh: () => void;
  stockBalances: Record<string, number>;
}

export const InventoryDocsView: React.FC<InventoryDocsViewProps> = ({ db, user, onRefresh, stockBalances }) => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'RECEIPT' | 'TRANSFER' | 'ISSUE' | 'CONSUMPTION'>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [docType, setDocType] = useState<'RECEIPT' | 'TRANSFER' | 'ISSUE' | 'CONSUMPTION'>('RECEIPT');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Suppliers Management Modal States
  const [showSuppliersModal, setShowSuppliersModal] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [supplierFormName, setSupplierFormName] = useState('');
  const [supplierFormPhone, setSupplierFormPhone] = useState('');
  const [supplierFormAddress, setSupplierFormAddress] = useState('');
  const [supplierFormNotes, setSupplierFormNotes] = useState('');
  const [supplierModalMsg, setSupplierModalMsg] = useState('');

  // Quick Inline Add Supplier
  const [showQuickAddSupplier, setShowQuickAddSupplier] = useState(false);
  const [quickSupplierName, setQuickSupplierName] = useState('');
  const [quickSupplierPhone, setQuickSupplierPhone] = useState('');

  // Find Surgery Pharmacy Warehouse ID for default consumption
  const surgeryWhId = useMemo(() => {
    const found = db.warehouses.find(w => w.code === 'ORDR' || w.name.includes('أدوية العمليات'));
    return found ? found.id : (db.warehouses[2]?.id || 3);
  }, [db.warehouses]);

  // Form states for new document
  const [supplierId, setSupplierId] = useState<number>(() => db.suppliers[0]?.id || 1);
  const [sourceWarehouseId, setSourceWarehouseId] = useState<number>(() => {
    return db.warehouses.find(w => w.is_active)?.id || 1;
  });
  const [destWarehouseId, setDestWarehouseId] = useState<number>(() => {
    const first = db.warehouses.find(w => w.is_active)?.id || 1;
    return db.warehouses.find(w => w.is_active && w.id !== first)?.id || first;
  });
  const [warehouseId, setWarehouseId] = useState<number>(() => {
    return db.warehouses.find(w => w.is_active)?.id || 1;
  });

  // Target department in ISSUE mode: Can be chosen from existing warehouses or custom typed
  const [issueTargetMode, setIssueTargetMode] = useState<'WAREHOUSE' | 'CUSTOM'>('WAREHOUSE');
  const [issuedTo, setIssuedTo] = useState('');
  const [department, setDepartment] = useState('');
  const [consumptionArea, setConsumptionArea] = useState('');
  const [procedureNo, setProcedureNo] = useState('');
  const [notes, setNotes] = useState('');
  
  // Lines state - quantity defaults to empty string for fast typing without pre-filled 0 or 1
  const [lines, setLines] = useState<{ item_id: number; quantity: number | ''; unit_id: number; batch_no?: string; expiry_date?: string }[]>([
    { item_id: db.items[0]?.id || 1, quantity: '', unit_id: db.units[0]?.id || 1 }
  ]);

  // Helper: Get stock balance of an item in a specific warehouse
  const getItemStockInWarehouse = (itemId: number, whId: number): number => {
    const key = `${itemId}-${whId}`;
    return stockBalances[key] || 0;
  };

  // Filter items available for the selected document type and warehouse
  const availableItemsForCurrentDoc = useMemo(() => {
    if (docType === 'RECEIPT') {
      // In receipts, any active item in the hospital catalog can be supplied
      return db.items.filter(it => it.is_active);
    }

    const activeWhId = docType === 'TRANSFER' ? sourceWarehouseId : warehouseId;

    // For Transfer, Issue, and Consumption:
    // Show items that have stock > 0 in this specific warehouse
    const itemsWithPositiveStock = db.items.filter(it => {
      if (!it.is_active) return false;
      const stock = getItemStockInWarehouse(it.id, activeWhId);
      return stock > 0;
    });

    // If warehouse has items with stock > 0, return them
    if (itemsWithPositiveStock.length > 0) {
      return itemsWithPositiveStock;
    }

    // Fallback: if no items currently have positive stock, show active items with stock 0 indicator
    return db.items.filter(it => it.is_active);
  }, [docType, sourceWarehouseId, warehouseId, db.items, stockBalances]);

  // Keep line items synchronized when warehouse changes
  const ensureValidLineItems = (availableList: typeof db.items) => {
    if (availableList.length === 0) return;
    setLines(prevLines => {
      return prevLines.map(l => {
        const isStillAvailable = availableList.some(it => it.id === l.item_id);
        if (!isStillAvailable) {
          const fallbackItem = availableList[0];
          return {
            ...l,
            item_id: fallbackItem.id,
            unit_id: fallbackItem.base_unit_id
          };
        }
        return l;
      });
    });
  };

  // Filters documents depending on warehouse permission and activeTab
  const getFilteredDocs = () => {
    let list = db.documents;
    if (activeTab !== 'ALL') {
      list = list.filter(d => d.document_type === activeTab);
    }
    // Filter by allowed warehouses for non-admins
    if (user.role !== 'ADMIN' && user.allowed_warehouses && user.allowed_warehouses.length > 0) {
      list = list.filter(d => {
        const whId = d.destination_warehouse_id || d.source_warehouse_id || d.warehouse_id;
        return whId ? user.allowed_warehouses.includes(whId) : true;
      });
    }
    return [...list].sort((a, b) => b.id - a.id);
  };

  const getDocTypeAr = (type: string) => {
    switch (type) {
      case 'RECEIPT': return 'توريد سلع وأدوية';
      case 'TRANSFER': return 'تحويل بين المستودعات';
      case 'ISSUE': return 'صرف لقسم/جهة';
      case 'CONSUMPTION': return 'استهلاك سريري';
      default: return 'مستند';
    }
  };

  const getDocStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT': return <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs px-2.5 py-1 rounded-full font-bold">مسودة</span>;
      case 'APPROVED': return <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs px-2.5 py-1 rounded-full font-bold">معتمد</span>;
      case 'VOIDED': return <span className="bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 text-xs px-2.5 py-1 rounded-full font-bold">ملغي/مبطل</span>;
      default: return null;
    }
  };

  const handleAddLine = () => {
    const firstAvail = availableItemsForCurrentDoc[0] || db.items[0];
    setLines([...lines, { 
      item_id: firstAvail?.id || 1, 
      quantity: '', 
      unit_id: firstAvail?.base_unit_id || db.units[0]?.id || 1 
    }]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, idx) => idx !== index));
    }
  };

  const handleLineChange = (index: number, key: string, value: any) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [key]: value };
    
    // Auto sync unit_id with the base unit of the item if item_id changes
    if (key === 'item_id') {
      const selectedItem = db.items.find(it => it.id === value);
      if (selectedItem) {
        updated[index].unit_id = selectedItem.base_unit_id;
      }
    }
    setLines(updated);
  };

  const handleSwitchDocType = (type: 'RECEIPT' | 'TRANSFER' | 'ISSUE' | 'CONSUMPTION') => {
    setDocType(type);
    resetForm(type);
  };

  const resetForm = (typeOverride?: 'RECEIPT' | 'TRANSFER' | 'ISSUE' | 'CONSUMPTION') => {
    const currentType = typeOverride || docType;
    setNotes('');
    setIssuedTo('');
    setProcedureNo('');
    
    const activeWhs = db.warehouses.filter(w => w.is_active);
    const firstWh = activeWhs[0]?.id || 1;
    const secondWh = activeWhs.find(w => w.id !== firstWh)?.id || firstWh;

    setSourceWarehouseId(firstWh);
    setDestWarehouseId(secondWh);

    if (currentType === 'CONSUMPTION') {
      setWarehouseId(surgeryWhId);
      setConsumptionArea('غرفة العمليات الجراحية');
      setDepartment('');
    } else if (currentType === 'ISSUE') {
      setWarehouseId(firstWh);
      setIssueTargetMode('WAREHOUSE');
      const otherWh = activeWhs.find(w => w.id !== firstWh);
      setDepartment(otherWh ? otherWh.name : 'قسم المستودعات');
      setConsumptionArea('');
    } else {
      setWarehouseId(firstWh);
      setDepartment('');
      setConsumptionArea('');
    }

    // Default first line with empty quantity for fast typing
    const avail = db.items.filter(i => i.is_active);
    const defaultItem = avail[0] || db.items[0];
    setLines([{ 
      item_id: defaultItem?.id || 1, 
      quantity: '', 
      unit_id: defaultItem?.base_unit_id || db.units[0]?.id || 1 
    }]);
  };

  // Quick Add Supplier
  const handleQuickAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSupplierName.trim()) return;

    const nextId = db.suppliers.length > 0 ? Math.max(...db.suppliers.map(s => s.id)) + 1 : 1;
    const newSupplier: Supplier = {
      id: nextId,
      code: `SUPP-${nextId.toString().padStart(2, '0')}`,
      name: quickSupplierName.trim(),
      phone: quickSupplierPhone.trim(),
      is_active: true
    };

    db.suppliers.push(newSupplier);
    saveDB(db);
    setSupplierId(newSupplier.id);
    setQuickSupplierName('');
    setQuickSupplierPhone('');
    setShowQuickAddSupplier(false);
    onRefresh();
    setSuccessMsg(`تمت إضافة المورد "${newSupplier.name}" واختياره بنجاح.`);
  };

  // Full Supplier Management handlers
  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    setSupplierModalMsg('');

    if (!supplierFormName.trim()) {
      setSupplierModalMsg('يرجى إدخال اسم المورد أو الشركة الموردة.');
      return;
    }

    if (editingSupplier) {
      // Edit mode
      const idx = db.suppliers.findIndex(s => s.id === editingSupplier.id);
      if (idx !== -1) {
        db.suppliers[idx] = {
          ...db.suppliers[idx],
          name: supplierFormName.trim(),
          phone: supplierFormPhone.trim(),
          address: supplierFormAddress.trim(),
          notes: supplierFormNotes.trim()
        };
        saveDB(db);
        setSupplierModalMsg(`تم تحديث بيانات المورد "${supplierFormName}" بنجاح.`);
      }
    } else {
      // Add mode
      const nextId = db.suppliers.length > 0 ? Math.max(...db.suppliers.map(s => s.id)) + 1 : 1;
      const newSupp: Supplier = {
        id: nextId,
        code: `SUPP-${nextId.toString().padStart(2, '0')}`,
        name: supplierFormName.trim(),
        phone: supplierFormPhone.trim(),
        address: supplierFormAddress.trim(),
        notes: supplierFormNotes.trim(),
        is_active: true
      };
      db.suppliers.push(newSupp);
      saveDB(db);
      setSupplierId(newSupp.id);
      setSupplierModalMsg(`تمت إضافة المورد "${newSupp.name}" بنجاح.`);
    }

    // Reset supplier form
    setEditingSupplier(null);
    setSupplierFormName('');
    setSupplierFormPhone('');
    setSupplierFormAddress('');
    setSupplierFormNotes('');
    onRefresh();
  };

  const handleEditSupplierClick = (supp: Supplier) => {
    setEditingSupplier(supp);
    setSupplierFormName(supp.name);
    setSupplierFormPhone(supp.phone || '');
    setSupplierFormAddress(supp.address || '');
    setSupplierFormNotes(supp.notes || '');
    setSupplierModalMsg('');
  };

  // Delete Supplier Confirmation Execution (In-App Modal, No window.confirm)
  const handleConfirmDeleteSupplier = () => {
    if (!supplierToDelete) return;

    const suppId = supplierToDelete.id;
    db.suppliers = db.suppliers.filter(s => s.id !== suppId);
    saveDB(db);
    
    if (supplierId === suppId) {
      setSupplierId(db.suppliers[0]?.id || 1);
    }
    
    if (editingSupplier?.id === suppId) {
      setEditingSupplier(null);
      setSupplierFormName('');
    }

    setSupplierModalMsg(`تم حذف المورد "${supplierToDelete.name}" بنجاح.`);
    setSupplierToDelete(null);
    onRefresh();
  };

  const handleCreateDocument = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Field Validations
    if (docType === 'TRANSFER' && sourceWarehouseId === destWarehouseId) {
      setErrorMsg('خطأ: لا يمكن تحويل المواد لنفس المستودع! يرجى اختيار مستودع وجهة مختلف.');
      return;
    }

    if (docType === 'ISSUE' && !department.trim()) {
      setErrorMsg('خطأ: يرجى تحديد القسم أو المستودع المستلم للصرف.');
      return;
    }

    if (lines.some(l => l.quantity === '' || Number(l.quantity) <= 0)) {
      setErrorMsg('خطأ: يرجى كتابة كمية صحيحة أكبر من الصفر في كل بند.');
      return;
    }

    // Auto generate Serial Number
    const prefix = docType === 'RECEIPT' ? 'REC' : docType === 'TRANSFER' ? 'TRF' : docType === 'ISSUE' ? 'ISS' : 'CON';
    const serialNum = `${prefix}-${Date.now().toString().slice(-6)}`;

    const newDoc: Document = {
      id: db.documents.length > 0 ? Math.max(...db.documents.map(d => d.id)) + 1 : 1,
      document_no: serialNum,
      document_date: new Date().toISOString().split('T')[0],
      document_type: docType,
      status: 'DRAFT',
      created_by: user.display_name,
      notes: notes,
      supplier_id: docType === 'RECEIPT' ? supplierId : undefined,
      destination_warehouse_id: docType === 'RECEIPT' || docType === 'TRANSFER' ? destWarehouseId : undefined,
      source_warehouse_id: docType === 'TRANSFER' ? sourceWarehouseId : undefined,
      warehouse_id: docType === 'ISSUE' || docType === 'CONSUMPTION' ? warehouseId : undefined,
      issued_to: docType === 'ISSUE' ? issuedTo : undefined,
      department: docType === 'ISSUE' ? department.trim() : undefined,
      consumption_area: docType === 'CONSUMPTION' ? consumptionArea.trim() : undefined,
      procedure_no: docType === 'CONSUMPTION' ? procedureNo.trim() : undefined,
      lines: lines.map((l, index) => ({
        id: index + 1,
        item_id: l.item_id,
        quantity: Number(l.quantity),
        unit_id: l.unit_id,
        batch_no: l.batch_no,
        expiry_date: l.expiry_date
      })),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.documents.push(newDoc);
    saveDB(db);
    setSuccessMsg(`تم حفظ المستند ${newDoc.document_no} كمسودة بنجاح.`);
    onRefresh();
    setShowCreateModal(false);
    resetForm();
  };

  const handleApprove = (docId: number) => {
    setErrorMsg('');
    setSuccessMsg('');
    const res = approveDocument(docId, user.id, user.display_name);
    if (res.success) {
      setSuccessMsg('تم اعتماد المستند وترحيله إلى الحركات المخزنية بنجاح!');
      onRefresh();
      if (selectedDoc && selectedDoc.id === docId) {
        setSelectedDoc(db.documents.find(d => d.id === docId) || null);
      }
    } else {
      setErrorMsg(res.error || 'حدث خطأ أثناء الاعتماد');
    }
  };

  const handleVoid = () => {
    if (!selectedDoc || !voidReason.trim()) return;
    const res = voidDocument(selectedDoc.id, user.id, user.display_name, voidReason);
    if (res.success) {
      setSuccessMsg('تم إبطال المستند وعكس حركاته بنجاح.');
      setShowVoidDialog(false);
      setVoidReason('');
      onRefresh();
      setSelectedDoc(db.documents.find(d => d.id === selectedDoc.id) || null);
    } else {
      setErrorMsg(res.error || 'حدث خطأ أثناء الإبطال');
      setShowVoidDialog(false);
    }
  };

  // Filtered suppliers list for modal
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return db.suppliers;
    const q = supplierSearch.toLowerCase().trim();
    return db.suppliers.filter(s => 
      s.name.toLowerCase().includes(q) || 
      (s.phone && s.phone.includes(q)) || 
      (s.address && s.address.toLowerCase().includes(q))
    );
  }, [db.suppliers, supplierSearch]);

  return (
    <div className="space-y-6">
      {/* Header and Filter Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">إدارة المستندات المخزنية</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs">إنشاء مسودات التوريد والتحويل والصرف والاستهلاك واعتمادها ذرياً.</p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button 
            onClick={() => { setShowSuppliersModal(true); setSupplierModalMsg(''); }}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
          >
            <Building2 size={16} className="text-blue-600 dark:text-blue-400" />
            إدارة الموردين
          </button>
          {user.role !== 'VIEWER' && (
            <button 
              onClick={() => { 
                setShowCreateModal(true); 
                resetForm('RECEIPT'); 
                setDocType('RECEIPT'); 
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Plus size={18} />
              إنشاء مستند جديد
            </button>
          )}
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {(['ALL', 'RECEIPT', 'TRANSFER', 'ISSUE', 'CONSUMPTION'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === tab 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab === 'ALL' ? 'كل المستندات' : getDocTypeAr(tab)}
          </button>
        ))}
      </div>

      {/* Success/Error Banners */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 rounded-xl text-sm font-bold flex items-center gap-2 animate-in fade-in">
          <Check size={18} className="shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-300 rounded-xl text-sm font-bold flex items-center gap-2 animate-in fade-in">
          <AlertCircle size={18} className="shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Grid: Document List + Document Detail Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Document list */}
        <div className={`${selectedDoc ? 'lg:col-span-7' : 'lg:col-span-12'} bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden transition-all`}>
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs border-b border-slate-100 dark:border-slate-800">
                  <th className="p-4">رقم السند</th>
                  <th className="p-4">النوع</th>
                  <th className="p-4">التاريخ</th>
                  <th className="p-4">أنشئ بواسطة</th>
                  <th className="p-4">الحالة</th>
                  <th className="p-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm text-slate-700 dark:text-slate-300">
                {getFilteredDocs().length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 dark:text-slate-500">
                      لا توجد مستندات مسجلة تحت هذا التصنيف.
                    </td>
                  </tr>
                ) : (
                  getFilteredDocs().map((doc) => (
                    <tr key={doc.id} className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer transition-colors ${selectedDoc?.id === doc.id ? 'bg-blue-50/40 dark:bg-blue-950/30' : ''}`}>
                      <td className="p-4 font-mono font-bold text-slate-800 dark:text-slate-100">{doc.document_no}</td>
                      <td className="p-4 font-semibold text-xs">{getDocTypeAr(doc.document_type)}</td>
                      <td className="p-4 text-slate-500 dark:text-slate-400 font-mono text-xs">{doc.document_date}</td>
                      <td className="p-4 text-slate-600 dark:text-slate-400 text-xs">{doc.created_by}</td>
                      <td className="p-4">{getDocStatusBadge(doc.status)}</td>
                      <td className="p-4 flex justify-center gap-2">
                        <button 
                          onClick={() => setSelectedDoc(doc)}
                          className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          title="عرض التفاصيل"
                        >
                          <Eye size={16} />
                        </button>
                        {doc.status === 'DRAFT' && user.role !== 'VIEWER' && (
                          <button 
                            onClick={() => handleApprove(doc.id)}
                            className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg font-bold transition-colors cursor-pointer"
                            title="اعتماد وترحيل"
                          >
                            <Check size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Document Detail Viewer */}
        {selectedDoc && (
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl p-5 space-y-4 relative flex flex-col justify-between">
            <button 
              onClick={() => setSelectedDoc(null)}
              className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-semibold cursor-pointer"
            >
              إغلاق ✕
            </button>
            <div className="space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm mb-1">
                  <FileText size={18} />
                  <span>تفاصيل السند</span>
                </div>
                <h3 className="font-mono text-xl font-black text-slate-800 dark:text-slate-100">{selectedDoc.document_no}</h3>
              </div>

              {/* Document Specs */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-150 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block">النوع</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{getDocTypeAr(selectedDoc.document_type)}</span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block">الحالة</span>
                  <span>{getDocStatusBadge(selectedDoc.status)}</span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block">تاريخ الإنشاء</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200 font-mono">{selectedDoc.document_date}</span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block">بواسطة</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{selectedDoc.created_by}</span>
                </div>

                {/* Conditional Fields based on Type */}
                {selectedDoc.document_type === 'RECEIPT' && (
                  <>
                    <div className="col-span-2">
                      <span className="text-slate-400 dark:text-slate-500 block">المورد المعتمد</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {db.suppliers.find(s => s.id === selectedDoc.supplier_id)?.name || 'غير محدد'}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 dark:text-slate-500 block">مستودع الوجهة</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {db.warehouses.find(w => w.id === selectedDoc.destination_warehouse_id)?.name || 'غير محدد'}
                      </span>
                    </div>
                  </>
                )}

                {selectedDoc.document_type === 'TRANSFER' && (
                  <>
                    <div>
                      <span className="text-slate-400 dark:text-slate-500 block">مستودع المصدر</span>
                      <span className="font-bold text-red-600 dark:text-red-400">
                        {db.warehouses.find(w => w.id === selectedDoc.source_warehouse_id)?.name || 'غير محدد'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 dark:text-slate-500 block">مستودع الوجهة</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {db.warehouses.find(w => w.id === selectedDoc.destination_warehouse_id)?.name || 'غير محدد'}
                      </span>
                    </div>
                  </>
                )}

                {(selectedDoc.document_type === 'ISSUE' || selectedDoc.document_type === 'CONSUMPTION') && (
                  <>
                    <div>
                      <span className="text-slate-400 dark:text-slate-500 block">المستودع المصدر</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {db.warehouses.find(w => w.id === selectedDoc.warehouse_id)?.name || 'غير محدد'}
                      </span>
                    </div>
                    {selectedDoc.document_type === 'ISSUE' ? (
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 block">القسم / الجهة المستلمة</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedDoc.department || 'غير محدد'} {selectedDoc.issued_to ? `(المستلم: ${selectedDoc.issued_to})` : ''}</span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 block">منطقة الاستهلاك / رقم العملية</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedDoc.consumption_area || 'العمليات'} - {selectedDoc.procedure_no || 'بدون رقم'}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Items List inside document */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">الأصناف المشمولة بالسند</h4>
                <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedDoc.lines.map((line) => {
                    const item = db.items.find(it => it.id === line.item_id);
                    const unit = db.units.find(u => u.id === line.unit_id);
                    return (
                      <div key={line.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-800 dark:text-slate-200 block">{item?.name_ar || 'صنف غير معروف'}</span>
                          <span className="text-slate-400 dark:text-slate-500 font-mono text-[10px]">SKU: {item?.sku}</span>
                        </div>
                        <div className="text-left">
                          <span className="font-bold text-slate-800 dark:text-slate-200 block">{line.quantity} {unit?.name_ar}</span>
                          {line.batch_no && <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-mono">باتش: {line.batch_no}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedDoc.notes && (
                <div className="text-xs bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 dark:text-slate-500 block mb-0.5">ملاحظات المستند</span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">{selectedDoc.notes}</p>
                </div>
              )}

              {selectedDoc.status === 'VOIDED' && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/60 text-red-800 dark:text-red-300 rounded-xl text-xs">
                  <span className="font-bold block">سبب الإبطال:</span>
                  <p>{selectedDoc.void_reason || 'غير محدد'}</p>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 mt-1">بواسطة {selectedDoc.voided_by} في {new Date(selectedDoc.voided_at!).toLocaleString('ar-EG')}</span>
                </div>
              )}
            </div>

            {/* Document Action Panel (Approve / Void) */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 flex gap-2">
              {selectedDoc.status === 'DRAFT' && user.role !== 'VIEWER' && (
                <button 
                  onClick={() => handleApprove(selectedDoc.id)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Check size={16} />
                  اعتماد وترحيل المستند
                </button>
              )}
              {selectedDoc.status === 'APPROVED' && user.role === 'ADMIN' && (
                <button 
                  onClick={() => setShowVoidDialog(true)}
                  className="w-full bg-red-100 dark:bg-red-950/60 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Ban size={16} />
                  إبطال المستند (عكس الحركات)
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 p-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">إنشاء مستند مخزني جديد</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateDocument} className="p-6 space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
                {(['RECEIPT', 'TRANSFER', 'ISSUE', 'CONSUMPTION'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleSwitchDocType(type)}
                    className={`py-2 px-1 rounded-xl text-[10px] md:text-xs font-black tracking-wide text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      docType === type 
                        ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-2 border-blue-600 shadow-sm' 
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    {type === 'RECEIPT' && <Building2 size={15} />}
                    {type === 'TRANSFER' && <ArrowRightLeft size={15} />}
                    {type === 'ISSUE' && <Send size={15} />}
                    {type === 'CONSUMPTION' && <Stethoscope size={15} />}
                    <span>{getDocTypeAr(type)}</span>
                  </button>
                ))}
              </div>

              {/* Conditional Headers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. RECEIPT: Suppliers & Destination Warehouse */}
                {docType === 'RECEIPT' && (
                  <>
                    <div className="space-y-1 md:col-span-2">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Building2 size={14} className="text-blue-600 dark:text-blue-400" />
                          المورد المعتمد
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowQuickAddSupplier(prev => !prev)}
                            className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <PlusCircle size={12} />
                            + مورد غير موجود
                          </button>
                          <span className="text-slate-300 dark:text-slate-700">|</span>
                          <button
                            type="button"
                            onClick={() => { setShowSuppliersModal(true); setSupplierModalMsg(''); }}
                            className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                          >
                            إدارة الموردين ⚙️
                          </button>
                        </div>
                      </div>

                      {/* Quick Add Supplier Accordion */}
                      {showQuickAddSupplier && (
                        <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl space-y-2 mb-2 animate-in fade-in">
                          <span className="text-xs font-bold text-blue-800 dark:text-blue-300 block">إضافة مورد جديد للقائمة فوراً:</span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              type="text"
                              value={quickSupplierName}
                              onChange={(e) => setQuickSupplierName(e.target.value)}
                              placeholder="اسم شركة التوريد / المورد"
                              className="sm:col-span-2 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                            />
                            <input
                              type="text"
                              value={quickSupplierPhone}
                              onChange={(e) => setQuickSupplierPhone(e.target.value)}
                              placeholder="رقم الهاتف (اختياري)"
                              className="border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                            />
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setShowQuickAddSupplier(false)}
                              className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                            >
                              إلغاء
                            </button>
                            <button
                              type="button"
                              onClick={handleQuickAddSupplier}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                            >
                              حفظ واختيار المورد
                            </button>
                          </div>
                        </div>
                      )}

                      <select 
                        value={supplierId} 
                        onChange={(e) => setSupplierId(Number(e.target.value))}
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                      >
                        {db.suppliers.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} {s.phone ? `(${s.phone})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">مستودع الوجهة (استلام الشحنة في)</label>
                      <select 
                        value={destWarehouseId} 
                        onChange={(e) => setDestWarehouseId(Number(e.target.value))}
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                      >
                        {db.warehouses.filter(w => w.is_active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                  </>
                )}

                {/* 2. TRANSFER: Source & Destination Warehouse */}
                {docType === 'TRANSFER' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">مستودع المصدر (سحب من)</label>
                      <select 
                        value={sourceWarehouseId} 
                        onChange={(e) => {
                          const newSource = Number(e.target.value);
                          setSourceWarehouseId(newSource);
                          if (destWarehouseId === newSource) {
                            const nextWh = db.warehouses.find(w => w.is_active && w.id !== newSource);
                            if (nextWh) setDestWarehouseId(nextWh.id);
                          }
                          // Synchronize items available in new source
                          const itemsInNewSource = db.items.filter(it => it.is_active && getItemStockInWarehouse(it.id, newSource) > 0);
                          ensureValidLineItems(itemsInNewSource.length > 0 ? itemsInNewSource : db.items);
                        }}
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 font-bold"
                      >
                        {db.warehouses.filter(w => w.is_active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 block mt-0.5">
                        💡 سيتم عرض الأصناف ذات الرصيد الفعلي المتاح في هذا المستودع فقط.
                      </span>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">مستودع الوجهة (إيداع في)</label>
                      <select 
                        value={destWarehouseId} 
                        onChange={(e) => setDestWarehouseId(Number(e.target.value))}
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 font-bold"
                      >
                        {db.warehouses.filter(w => w.is_active && w.id !== sourceWarehouseId).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                  </>
                )}

                {/* 3. ISSUE: Source Warehouse + Remaining Warehouses OR Custom Department Input */}
                {docType === 'ISSUE' && (
                  <>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">المستودع المصدر (الصرف منه)</label>
                      <select 
                        value={warehouseId} 
                        onChange={(e) => {
                          const newWh = Number(e.target.value);
                          setWarehouseId(newWh);
                          const itemsInNewWh = db.items.filter(it => it.is_active && getItemStockInWarehouse(it.id, newWh) > 0);
                          ensureValidLineItems(itemsInNewWh.length > 0 ? itemsInNewWh : db.items);
                          
                          // If current target department was the new source warehouse, adjust to next warehouse
                          if (issueTargetMode === 'WAREHOUSE') {
                            const nextTargetWh = db.warehouses.find(w => w.is_active && w.id !== newWh);
                            if (nextTargetWh) setDepartment(nextTargetWh.name);
                          }
                        }}
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 font-bold"
                      >
                        {db.warehouses.filter(w => w.is_active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 block mt-0.5">
                        💡 تظهر فقط بنود وأدوية هذا القسم والمتاحة برصيد بالمستودع.
                      </span>
                    </div>

                    {/* Receiving Department / Warehouse Selection */}
                    <div className="space-y-1 md:col-span-2 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          {issueTargetMode === 'WAREHOUSE' ? <WarehouseIcon size={14} className="text-blue-600" /> : <PenTool size={14} className="text-purple-600" />}
                          القسم / المستودع المستلم
                        </label>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setIssueTargetMode('WAREHOUSE');
                              const nextTarget = db.warehouses.find(w => w.is_active && w.id !== warehouseId);
                              if (nextTarget) setDepartment(nextTarget.name);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              issueTargetMode === 'WAREHOUSE'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            🏢 من مخازن وأقسام النظام
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIssueTargetMode('CUSTOM');
                              setDepartment('');
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              issueTargetMode === 'CUSTOM'
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            ✍️ كتابة قسم / جهة مخصصة
                          </button>
                        </div>
                      </div>

                      {issueTargetMode === 'WAREHOUSE' ? (
                        <div className="space-y-1">
                          <select
                            value={department}
                            onChange={(e) => setDepartment(e.target.value)}
                            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 font-bold"
                            required
                          >
                            {db.warehouses.filter(w => w.is_active && w.id !== warehouseId).map(w => (
                              <option key={w.id} value={w.name}>
                                {w.name} ({w.code})
                              </option>
                            ))}
                          </select>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                            المخازن والأقسام المعرفة بالنظام (مستثنى منها المستودع المصدر).
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={department}
                            onChange={(e) => setDepartment(e.target.value)}
                            placeholder="اكتب اسم القسم، العيادة، أو الجهة المستلمة هنا..."
                            className="w-full border border-purple-300 dark:border-purple-700 rounded-xl p-2.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 font-bold"
                            autoFocus
                            required
                          />
                          <span className="text-[10px] text-purple-600 dark:text-purple-400 block">
                            يمكنك كتابة أي قسم أو جهة غير مسجلة كمخزن رسمي (مثل: عيادة الباطنة، الإسعاف، التحاليل الخارجية، إلخ).
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">اسم المستلم / المشرف</label>
                      <input 
                        type="text" 
                        value={issuedTo} 
                        onChange={(e) => setIssuedTo(e.target.value)}
                        placeholder="اسم الممرض / الطبيب / المستلم"
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </>
                )}

                {/* 4. CONSUMPTION: Surgery Warehouse by Default & Area */}
                {docType === 'CONSUMPTION' && (
                  <>
                    <div className="space-y-1 md:col-span-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">مستودع الاستهلاك (الافتراضي: مخزن أدوية العمليات)</label>
                        <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-900/60">
                          مخزن العمليات الافتراضي ⭐
                        </span>
                      </div>
                      <select 
                        value={warehouseId} 
                        onChange={(e) => {
                          const newWh = Number(e.target.value);
                          setWarehouseId(newWh);
                          const itemsInNewWh = db.items.filter(it => it.is_active && getItemStockInWarehouse(it.id, newWh) > 0);
                          ensureValidLineItems(itemsInNewWh.length > 0 ? itemsInNewWh : db.items);
                        }}
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 font-bold"
                      >
                        {db.warehouses.filter(w => w.is_active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">مكان/غرفة الاستهلاك</label>
                      <input 
                        type="text" 
                        value={consumptionArea} 
                        onChange={(e) => setConsumptionArea(e.target.value)}
                        placeholder="غرفة العمليات، الإفاقة، إلخ..."
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">رقم العملية (إن وجد)</label>
                      <input 
                        type="text" 
                        value={procedureNo} 
                        onChange={(e) => setProcedureNo(e.target.value)}
                        placeholder="OP-948"
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Items Multiple Lines Editor */}
              <div className="space-y-3">
                <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <PackageCheck size={14} className="text-blue-600 dark:text-blue-400" />
                      بنود وأصناف المستند
                    </h4>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {docType === 'RECEIPT' ? 'جميع أصناف الكتالوج متاحة للتوريد' : 'يتم عرض أصناف المستودع المختار ورصيدها المتاح'}
                    </span>
                  </div>
                  <button 
                    type="button" 
                    onClick={handleAddLine}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-900/60 cursor-pointer"
                  >
                    <Plus size={14} />
                    إضافة سطر جديد
                  </button>
                </div>

                <div className="max-h-[240px] overflow-y-auto space-y-2 border border-slate-100 dark:border-slate-800 p-2.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40">
                  {lines.map((line, index) => {
                    const currentItem = db.items.find(it => it.id === line.item_id);
                    const activeWhId = docType === 'TRANSFER' ? sourceWarehouseId : warehouseId;
                    const liveStock = currentItem ? getItemStockInWarehouse(currentItem.id, activeWhId) : 0;
                    
                    return (
                      <div key={index} className="flex flex-wrap sm:flex-nowrap gap-2 items-center bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
                        {/* Item Picker */}
                        <div className="flex-1 min-w-[200px]">
                          <select
                            value={line.item_id}
                            onChange={(e) => handleLineChange(index, 'item_id', Number(e.target.value))}
                            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                          >
                            {availableItemsForCurrentDoc.map(it => {
                              const stock = getItemStockInWarehouse(it.id, activeWhId);
                              const stockLabel = docType !== 'RECEIPT' ? ` - (المتاح: ${stock})` : '';
                              return (
                                <option key={it.id} value={it.id}>
                                  {it.name_ar} ({it.sku}){stockLabel}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {/* Quantity (Empty by default for fast direct typing) */}
                        <div className="w-24">
                          <input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(e) => handleLineChange(index, 'quantity', e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs text-center bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-blue-500"
                            placeholder="الكمية"
                            required
                          />
                        </div>

                        {/* Unit Name (Display Only) */}
                        <div className="w-16 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                          {db.units.find(u => u.id === (currentItem?.base_unit_id || line.unit_id))?.name_ar || 'وحدة'}
                        </div>

                        {/* Available stock badge for Transfer / Issue / Consumption */}
                        {docType !== 'RECEIPT' && (
                          <div className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            liveStock > 0 
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50' 
                              : 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50'
                          }`}>
                            رصيد: {liveStock}
                          </div>
                        )}

                        {/* Optional Batch for Receipts */}
                        {docType === 'RECEIPT' && (
                          <div className="w-24 shrink-0">
                            <input
                              type="text"
                              value={line.batch_no || ''}
                              onChange={(e) => handleLineChange(index, 'batch_no', e.target.value)}
                              placeholder="الباتش"
                              className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                            />
                          </div>
                        )}

                        {/* Delete Line Button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(index)}
                          className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-1 shrink-0 transition-colors cursor-pointer"
                          disabled={lines.length === 1}
                          title="حذف هذا السطر"
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">ملاحظات المستند</label>
                <textarea 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أكتب أي ملاحظات إدارية أو تشغيلية تخص هذا المستند..."
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  rows={2}
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-4 mt-4">
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  حفظ كمسودة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Suppliers Management Modal */}
      {showSuppliersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 p-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Building2 size={18} className="text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">إدارة الموردين والشركات الموردة</h3>
              </div>
              <button 
                onClick={() => { setShowSuppliersModal(false); setEditingSupplier(null); }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {supplierModalMsg && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <Check size={16} className="text-emerald-600 shrink-0" />
                  <span>{supplierModalMsg}</span>
                </div>
              )}

              {/* Add / Edit Supplier Form */}
              <form onSubmit={handleSaveSupplier} className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    {editingSupplier ? <Edit2 size={14} className="text-amber-500" /> : <Plus size={14} className="text-blue-600" />}
                    {editingSupplier ? `تعديل بيانات المورد (${editingSupplier.name})` : 'إضافة مورد جديد للنظام'}
                  </span>
                  {editingSupplier && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSupplier(null);
                        setSupplierFormName('');
                        setSupplierFormPhone('');
                        setSupplierFormAddress('');
                        setSupplierFormNotes('');
                      }}
                      className="text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-bold cursor-pointer"
                    >
                      إلغاء التعديل
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">اسم المورد / الشركة *</label>
                    <input
                      type="text"
                      value={supplierFormName}
                      onChange={(e) => setSupplierFormName(e.target.value)}
                      placeholder="الشركة المصرية الدولية للأدوية..."
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">رقم الهاتف / مسؤول التواصل</label>
                    <input
                      type="text"
                      value={supplierFormPhone}
                      onChange={(e) => setSupplierFormPhone(e.target.value)}
                      placeholder="010XXXXXXXX أو 02-33445566"
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">العنوان / المقر</label>
                    <input
                      type="text"
                      value={supplierFormAddress}
                      onChange={(e) => setSupplierFormAddress(e.target.value)}
                      placeholder="مدينة العاشر من رمضان، مصر"
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">ملاحظات إضافية</label>
                    <input
                      type="text"
                      value={supplierFormNotes}
                      onChange={(e) => setSupplierFormNotes(e.target.value)}
                      placeholder="تخصص: خيوط جراحية، محاليل، إلخ"
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Check size={14} />
                    {editingSupplier ? 'حفظ التعديلات' : 'إضافة المورد'}
                  </button>
                </div>
              </form>

              {/* Suppliers List Table with Search */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                    قائمة الموردين المسجلين ({db.suppliers.length})
                  </h4>
                  <div className="relative w-full sm:w-64">
                    <Search size={14} className="absolute right-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={supplierSearch}
                      onChange={(e) => setSupplierSearch(e.target.value)}
                      placeholder="بحث عن مورد بالاسم أو الهاتف..."
                      className="w-full pl-3 pr-8 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 sticky top-0">
                        <th className="p-3">اسم المورد</th>
                        <th className="p-3">الهاتف</th>
                        <th className="p-3">العنوان</th>
                        <th className="p-3 text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                      {filteredSuppliers.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-8 text-slate-400">
                            لا يوجد موردين مطابقين للبحث.
                          </td>
                        </tr>
                      ) : (
                        filteredSuppliers.map((supp) => (
                          <tr key={supp.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="p-3 font-bold text-slate-800 dark:text-slate-100">
                              {supp.name}
                              {supp.notes && <span className="block text-[10px] text-slate-400 font-normal">{supp.notes}</span>}
                            </td>
                            <td className="p-3 font-mono text-slate-600 dark:text-slate-400">{supp.phone || '-'}</td>
                            <td className="p-3 text-slate-600 dark:text-slate-400">{supp.address || '-'}</td>
                            <td className="p-3 flex justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleEditSupplierClick(supp)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-lg transition-colors cursor-pointer"
                                title="تعديل المورد"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setSupplierToDelete(supp)}
                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/60 rounded-lg transition-colors cursor-pointer"
                                title="حذف المورد"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 p-4 flex justify-end">
              <button
                type="button"
                onClick={() => { setShowSuppliersModal(false); setEditingSupplier(null); }}
                className="px-5 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Supplier Delete Confirmation Modal */}
      {supplierToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-red-600">
              <div className="p-2 bg-red-100 dark:bg-red-950/60 rounded-xl">
                <Trash2 size={20} />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">تأكيد حذف المورد</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              هل أنت متأكد من حذف المورد <strong className="text-slate-900 dark:text-slate-100 font-bold">"{supplierToDelete.name}"</strong> نهائياً من سجل الموردين؟
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSupplierToDelete(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSupplier}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                نعم، تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void Reason Dialogue */}
      {showVoidDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-4">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">إبطال المستند وتصفير حركاته</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              سيؤدي هذا الإجراء إلى تسجيل حركات عكسية تلقائية في سجل الحركات، واسترجاع الكميات السابقة لحالتها. يرجى توضيح سبب الإبطال:
            </p>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="سبب الإلغاء أو الخطأ في الإدخال..."
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              rows={3}
              required
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => { setShowVoidDialog(false); setVoidReason(''); }}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                تراجع
              </button>
              <button
                onClick={handleVoid}
                disabled={!voidReason.trim()}
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl disabled:opacity-50 cursor-pointer"
              >
                تأكيد الإبطال
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
