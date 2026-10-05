import React, { useState } from 'react';
import { Plus, Trash, Check, Ban, FileText, Eye, AlertCircle } from 'lucide-react';
import { DBSchema, Document, approveDocument, voidDocument, saveDB } from '../data/db';

interface InventoryDocsViewProps {
  db: DBSchema;
  user: any;
  onRefresh: () => void;
  stockBalances: Record<string, number>;
}

export const InventoryDocsView: React.FC<InventoryDocsViewProps> = ({ db, user, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'RECEIPT' | 'TRANSFER' | 'ISSUE' | 'CONSUMPTION'>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [docType, setDocType] = useState<'RECEIPT' | 'TRANSFER' | 'ISSUE' | 'CONSUMPTION'>('RECEIPT');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states for new document
  const [supplierId, setSupplierId] = useState<number>(1);
  const [sourceWarehouseId, setSourceWarehouseId] = useState<number>(() => {
    return db.warehouses.find(w => w.is_active)?.id || 1;
  });
  const [destWarehouseId, setDestWarehouseId] = useState<number>(() => {
    const first = db.warehouses.find(w => w.is_active)?.id || 1;
    return db.warehouses.find(w => w.is_active && w.id !== first)?.id || first;
  });
  const [warehouseId, setWarehouseId] = useState<number>(1);
  const [issuedTo, setIssuedTo] = useState('');
  const [department, setDepartment] = useState('');
  const [consumptionArea, setConsumptionArea] = useState('');
  const [procedureNo, setProcedureNo] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<{ item_id: number; quantity: number; unit_id: number; batch_no?: string; expiry_date?: string }[]>([
    { item_id: db.items[0]?.id || 1, quantity: 10, unit_id: db.units[0]?.id || 1 }
  ]);

  // Filters documents depending on warehouse permission and activeTab
  const getFilteredDocs = () => {
    let list = db.documents;
    if (activeTab !== 'ALL') {
      list = list.filter(d => d.document_type === activeTab);
    }
    // Filter by allowed warehouses for non-admins
    if (user.role !== 'ADMIN' && user.allowed_warehouses.length > 0) {
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
    setLines([...lines, { item_id: db.items[0]?.id || 1, quantity: 1, unit_id: db.units[0]?.id || 1 }]);
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

  const handleCreateDocument = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Field Validations
    if (docType === 'TRANSFER' && sourceWarehouseId === destWarehouseId) {
      setErrorMsg('خطأ: لا يمكن تحويل المواد لنفس المستودع! يرجى اختيار مستودع وجهة مختلف.');
      return;
    }

    if (lines.some(l => l.quantity <= 0)) {
      setErrorMsg('خطأ: يجب أن تكون جميع الكميات المطلوبة أكبر من الصفر.');
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
      department: docType === 'ISSUE' ? department : undefined,
      consumption_area: docType === 'CONSUMPTION' ? consumptionArea : undefined,
      procedure_no: docType === 'CONSUMPTION' ? procedureNo : undefined,
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
    setSuccessMsg('تم حفظ المستند كمسودة بنجاح.');
    onRefresh();
    setShowCreateModal(false);
    resetForm();
  };

  const resetForm = () => {
    setNotes('');
    setIssuedTo('');
    setDepartment('');
    setConsumptionArea('');
    setProcedureNo('');
    setLines([{ item_id: db.items[0]?.id || 1, quantity: 1, unit_id: db.units[0]?.id || 1 }]);
    const activeWhs = db.warehouses.filter(w => w.is_active);
    const firstWh = activeWhs[0]?.id || 1;
    const secondWh = activeWhs.find(w => w.id !== firstWh)?.id || firstWh;
    setSourceWarehouseId(firstWh);
    setDestWarehouseId(secondWh);
    setWarehouseId(firstWh);
  };

  const handleApprove = (docId: number) => {
    setErrorMsg('');
    setSuccessMsg('');
    const res = approveDocument(docId, user.id, user.display_name);
    if (res.success) {
      setSuccessMsg('تم اعتماد المستند وترحيله إلى الحركات المخزنية بنجاح!');
      onRefresh();
      // Update selected doc if open
      if (selectedDoc && selectedDoc.id === docId) {
        const freshDb = db;
        setSelectedDoc(freshDb.documents.find(d => d.id === docId) || null);
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
      // Update view
      setSelectedDoc(db.documents.find(d => d.id === selectedDoc.id) || null);
    } else {
      setErrorMsg(res.error || 'حدث خطأ أثناء الإبطال');
      setShowVoidDialog(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Filter Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">إدارة المستندات المخزنية</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs">إنشاء مسودات التوريد والتحويل والصرف والاستهلاك واعتمادها ذرياً.</p>
        </div>
        {user.role !== 'VIEWER' && (
          <button 
            onClick={() => { setShowCreateModal(true); resetForm(); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm transition-all self-start md:self-auto"
          >
            <Plus size={18} />
            إنشاء مستند جديد
          </button>
        )}
      </div>

      {/* Tabs Filter */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {(['ALL', 'RECEIPT', 'TRANSFER', 'ISSUE', 'CONSUMPTION'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
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
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 rounded-xl text-sm font-bold flex items-center gap-2">
          <Check size={18} className="shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-300 rounded-xl text-sm font-bold flex items-center gap-2">
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
                          className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title="عرض التفاصيل"
                        >
                          <Eye size={16} />
                        </button>
                        {doc.status === 'DRAFT' && user.role !== 'VIEWER' && (
                          <button 
                            onClick={() => handleApprove(doc.id)}
                            className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg font-bold transition-colors"
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
              className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-semibold"
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
                      <span className="text-slate-400 dark:text-slate-500 block">المورد</span>
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
                      <span className="text-slate-400 dark:text-slate-500 block">المستودع</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {db.warehouses.find(w => w.id === selectedDoc.warehouse_id)?.name || 'غير محدد'}
                      </span>
                    </div>
                    {selectedDoc.document_type === 'ISSUE' ? (
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 block">القسم / المستلم</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedDoc.issued_to} ({selectedDoc.department})</span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 block">منطقة الاستهلاك / رقم العملية</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedDoc.consumption_area} - {selectedDoc.procedure_no || 'بدون رقم'}</span>
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
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                >
                  <Check size={16} />
                  اعتماد وترحيل المستند
                </button>
              )}
              {selectedDoc.status === 'APPROVED' && user.role === 'ADMIN' && (
                <button 
                  onClick={() => setShowVoidDialog(true)}
                  className="w-full bg-red-100 dark:bg-red-950/60 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
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
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 p-4 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">إنشاء مستند مخزني جديد</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateDocument} className="p-6 space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
                {(['RECEIPT', 'TRANSFER', 'ISSUE', 'CONSUMPTION'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => { setDocType(type); resetForm(); }}
                    className={`py-2 px-1 rounded-xl text-[10px] md:text-xs font-black tracking-wide text-center transition-all ${
                      docType === type 
                        ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-2 border-blue-600' 
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {getDocTypeAr(type)}
                  </button>
                ))}
              </div>

              {/* Conditional Headers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {docType === 'RECEIPT' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">المورد المعتمد</label>
                      <select 
                        value={supplierId} 
                        onChange={(e) => setSupplierId(Number(e.target.value))}
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                      >
                        {db.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">مستودع الوجهة</label>
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
                        }}
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                      >
                        {db.warehouses.filter(w => w.is_active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">مستودع الوجهة (إيداع في)</label>
                      <select 
                        value={destWarehouseId} 
                        onChange={(e) => setDestWarehouseId(Number(e.target.value))}
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                      >
                        {db.warehouses.filter(w => w.is_active && w.id !== sourceWarehouseId).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                  </>
                )}

                {docType === 'ISSUE' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">المستودع المصدر</label>
                      <select 
                        value={warehouseId} 
                        onChange={(e) => setWarehouseId(Number(e.target.value))}
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                      >
                        {db.warehouses.filter(w => w.is_active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">المستلم</label>
                        <input 
                          type="text" 
                          value={issuedTo} 
                          onChange={(e) => setIssuedTo(e.target.value)}
                          placeholder="اسم الممرض/الطبيب"
                          className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">القسم المستلم</label>
                        <input 
                          type="text" 
                          value={department} 
                          onChange={(e) => setDepartment(e.target.value)}
                          placeholder="العيادات، الاستقبال، إلخ"
                          className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                          required
                        />
                      </div>
                    </div>
                  </>
                )}

                {docType === 'CONSUMPTION' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">مستودع الاستهلاك</label>
                      <select 
                        value={warehouseId} 
                        onChange={(e) => setWarehouseId(Number(e.target.value))}
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                      >
                        {db.warehouses.filter(w => w.is_active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">مكان/غرفة الاستهلاك</label>
                        <input 
                          type="text" 
                          value={consumptionArea} 
                          onChange={(e) => setConsumptionArea(e.target.value)}
                          placeholder="غرفة العمليات رقم 3"
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
                    </div>
                  </>
                )}
              </div>

              {/* Items Multiple Lines Editor */}
              <div className="space-y-3">
                <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-4">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">بنود وأصناف المستند</h4>
                  <button 
                    type="button" 
                    onClick={handleAddLine}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                  >
                    <Plus size={14} />
                    إضافة سطر جديد
                  </button>
                </div>

                <div className="max-h-[200px] overflow-y-auto space-y-2 border border-slate-100 dark:border-slate-800 p-2.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40">
                  {lines.map((line, index) => {
                    const currentItem = db.items.find(it => it.id === line.item_id);
                    return (
                      <div key={index} className="flex gap-2 items-center bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                        {/* Item Picker */}
                        <div className="flex-1 min-w-0">
                          <select
                            value={line.item_id}
                            onChange={(e) => handleLineChange(index, 'item_id', Number(e.target.value))}
                            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                          >
                            {db.items.filter(it => it.is_active).map(it => (
                              <option key={it.id} value={it.id}>{it.name_ar} ({it.sku})</option>
                            ))}
                          </select>
                        </div>

                        {/* Quantity */}
                        <div className="w-20">
                          <input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(e) => handleLineChange(index, 'quantity', Number(e.target.value))}
                            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs text-center bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold"
                            placeholder="الكمية"
                            required
                          />
                        </div>

                        {/* Unit Name (Display Only) */}
                        <div className="w-16 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {db.units.find(u => u.id === (currentItem?.base_unit_id || line.unit_id))?.name_ar || 'وحدة'}
                        </div>

                        {/* Optional Batch */}
                        {docType === 'RECEIPT' && (
                          <div className="w-24">
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
                          className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-1"
                          disabled={lines.length === 1}
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
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                >
                  حفظ كمسودة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Void Reason Dialogue */}
      {showVoidDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-4">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">إبطال المستند وتصفير حركاته</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              تنبيه: سيؤدي هذا الإجراء إلى عكس حركات المخزن وتصحيح الأرصدة. هذه العملية مسجلة في سجل التدقيق ولا يمكن التراجع عنها.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">سبب الإلغاء / الإبطال (إجباري)</label>
              <textarea 
                value={voidReason} 
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="مثال: تم إدخال الصنف بالخطأ، أو تعديل الكميات..."
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                rows={3}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button 
                type="button" 
                onClick={() => { setShowVoidDialog(false); setVoidReason(''); }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl"
              >
                رجوع
              </button>
              <button 
                type="button" 
                onClick={handleVoid}
                disabled={!voidReason.trim()}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl disabled:opacity-50"
              >
                تأكيد الإبطال والعكس
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
