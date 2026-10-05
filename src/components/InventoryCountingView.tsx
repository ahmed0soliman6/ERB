import React, { useState } from 'react';
import { Plus, Check, ClipboardList, Trash, Eye, AlertCircle, Save } from 'lucide-react';
import { DBSchema, InventoryCount, saveDB, approveInventoryCount } from '../data/db';

interface InventoryCountingViewProps {
  db: DBSchema;
  user: any;
  onRefresh: () => void;
  stockBalances: Record<string, number>;
}

export const InventoryCountingView: React.FC<InventoryCountingViewProps> = ({ db, user, onRefresh, stockBalances }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCount, setSelectedCount] = useState<InventoryCount | null>(null);
  const [warehouseId, setWarehouseId] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form states for adding physical quantities to a draft counting session
  const [physicalQuantities, setPhysicalQuantities] = useState<Record<string, number>>({});
  const [lineNotes, setLineNotes] = useState<Record<string, string>>({});

  const canManage = user.role === 'ADMIN' || user.role === 'STORE_MANAGER';

  // Filters count sessions dependent on allowed warehouses
  const getFilteredCounts = () => {
    let list = db.counts;
    if (user.role !== 'ADMIN' && user.allowed_warehouses.length > 0) {
      list = list.filter(c => user.allowed_warehouses.includes(c.warehouse_id));
    }
    return [...list].sort((a, b) => b.id - a.id);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT': return <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs px-2.5 py-1 rounded-full font-bold">جلسة مسودة</span>;
      case 'APPROVED': return <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs px-2.5 py-1 rounded-full font-bold">معتمدة ومرحلة</span>;
      case 'CANCELLED': return <span className="bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-xs px-2.5 py-1 rounded-full font-bold">ملغاة</span>;
      default: return null;
    }
  };

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Pre-calculate running book stock for all active items in this warehouse
    // to "freeze" them on session creation
    const calculateStock = (itemId: number) => {
      return db.movements
        .filter(m => m.item_id === itemId && m.warehouse_id === warehouseId)
        .reduce((sum, m) => sum + m.signed_quantity, 0);
    };

    const countNo = `CNT-${Date.now().toString().slice(-6)}`;
    const newSession: InventoryCount = {
      id: db.counts.length > 0 ? Math.max(...db.counts.map(c => c.id)) + 1 : 1,
      count_no: countNo,
      warehouse_id: warehouseId,
      count_date: new Date().toISOString().split('T')[0],
      status: 'DRAFT',
      created_by: user.display_name,
      notes: notes,
      lines: db.items.filter(it => it.is_active).map(it => {
        const bookQty = calculateStock(it.id);
        return {
          id: it.id,
          item_id: it.id,
          book_quantity: bookQty,
          physical_quantity: bookQty, // default to book initially
          difference_quantity: 0,
          unit_id: it.base_unit_id,
          notes: ''
        };
      }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const freshDb = db;
    freshDb.counts.push(newSession);

    freshDb.audit_logs.push({
      id: freshDb.audit_logs.length > 0 ? Math.max(...freshDb.audit_logs.map(a => a.id)) + 1 : 1,
      user_id: user.id,
      username: user.display_name,
      action: 'فتح جلسة جرد جديدة',
      entity_type: 'جرد مخازن',
      entity_id: newSession.id,
      occurred_at: new Date().toISOString()
    });

    saveDB(freshDb);
    setShowCreateModal(false);
    setNotes('');
    setSuccessMsg(`تم إنشاء جلسة الجرد ${countNo} بنجاح. يمكنك الآن إدخال الأرقام الفعلية.`);
    setSelectedCount(newSession);
    
    // Initialize editing states
    const pq: Record<string, number> = {};
    const ln: Record<string, string> = {};
    newSession.lines.forEach(l => {
      pq[l.item_id] = l.physical_quantity;
      ln[l.item_id] = '';
    });
    setPhysicalQuantities(pq);
    setLineNotes(ln);

    onRefresh();
  };

  const handleSaveDraftChanges = () => {
    if (!selectedCount) return;
    const freshDb = db;
    const cIdx = freshDb.counts.findIndex(c => c.id === selectedCount.id);
    if (cIdx !== -1) {
      const count = freshDb.counts[cIdx];
      if (count.status !== 'DRAFT') return;

      count.lines = count.lines.map(line => {
        const physical = physicalQuantities[line.item_id] !== undefined ? Number(physicalQuantities[line.item_id]) : line.physical_quantity;
        return {
          ...line,
          physical_quantity: physical,
          difference_quantity: physical - line.book_quantity,
          notes: lineNotes[line.item_id] || line.notes
        };
      });

      count.updated_at = new Date().toISOString();
      saveDB(freshDb);
      setSuccessMsg('تم حفظ تعديلات الكميات الفعلية كمسودة بنجاح.');
      setSelectedCount(count);
      onRefresh();
    }
  };

  const handleApproveSession = (countId: number) => {
    setErrorMsg('');
    setSuccessMsg('');

    // Save current editing state first before approving
    handleSaveDraftChanges();

    const res = approveInventoryCount(countId, user.id, user.display_name);
    if (res.success) {
      setSuccessMsg('تم اعتماد محضر الجرد وترحيل فروقات التسوية عجزاً وزيادة إلى حركات المخزن بنجاح!');
      onRefresh();
      setSelectedCount(db.counts.find(c => c.id === countId) || null);
    } else {
      setErrorMsg(res.error || 'حدث خطأ أثناء اعتماد الجلسة.');
    }
  };

  const handleCancelSession = (countId: number) => {
    if (!canManage) return;
    const freshDb = db;
    const cIdx = freshDb.counts.findIndex(c => c.id === countId);
    if (cIdx !== -1) {
      const count = freshDb.counts[cIdx];
      if (count.status !== 'DRAFT') return;

      count.status = 'CANCELLED';
      count.updated_at = new Date().toISOString();

      freshDb.audit_logs.push({
        id: freshDb.audit_logs.length > 0 ? Math.max(...freshDb.audit_logs.map(a => a.id)) + 1 : 1,
        user_id: user.id,
        username: user.display_name,
        action: 'إلغاء جلسة جرد',
        entity_type: 'جرد مخازن',
        entity_id: count.id,
        occurred_at: new Date().toISOString()
      });

      saveDB(freshDb);
      setSuccessMsg('تم إلغاء محضر الجلسة.');
      setSelectedCount(count);
      onRefresh();
    }
  };

  const handlePhysicalQtyChange = (itemId: number, val: number) => {
    setPhysicalQuantities({
      ...physicalQuantities,
      [itemId]: Math.max(0, val)
    });
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">إدارة الجرد وتصحيح الفروقات</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs">تثبيت جلسات الجرد، رصد فروق الدفتر والعد الفعلي، واعتماد التسويات المخزنية.</p>
        </div>
        {user.role !== 'VIEWER' && (
          <button 
            onClick={() => setShowCreateModal(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm transition-all self-start md:self-auto cursor-pointer"
          >
            <Plus size={18} />
            فتح جلسة جرد مستودع
          </button>
        )}
      </div>

      {/* Warnings & Success banners */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-sm font-bold flex items-center gap-2">
          <Check size={18} />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-xl text-sm font-bold flex items-center gap-2">
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Grid: Sessions List + Detail Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={`${selectedCount ? 'lg:col-span-4' : 'lg:col-span-12'} bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 shadow-sm rounded-xl overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs border-b border-slate-150 dark:border-slate-800">
                  <th className="p-4">محضر الجرد</th>
                  <th className="p-4">المستودع</th>
                  <th className="p-4 text-center">التاريخ</th>
                  <th className="p-4">الحالة</th>
                  <th className="p-4 text-center">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm text-slate-700 dark:text-slate-300">
                {getFilteredCounts().length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400 dark:text-slate-500">
                      لا توجد جلسات جرد مسجلة حالياً.
                    </td>
                  </tr>
                ) : (
                  getFilteredCounts().map((cnt) => (
                    <tr key={cnt.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors ${selectedCount?.id === cnt.id ? 'bg-teal-50/20 dark:bg-teal-950/20' : ''}`}>
                      <td className="p-4 font-mono font-bold text-slate-800 dark:text-slate-200">{cnt.count_no}</td>
                      <td className="p-4 font-semibold text-xs">{db.warehouses.find(w => w.id === cnt.warehouse_id)?.name}</td>
                      <td className="p-4 text-slate-500 dark:text-slate-400 font-mono text-xs text-center">{cnt.count_date}</td>
                      <td className="p-4">{getStatusBadge(cnt.status)}</td>
                      <td className="p-4 flex justify-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedCount(cnt);
                            // Populate editing states
                            const pq: Record<string, number> = {};
                            const ln: Record<string, string> = {};
                            cnt.lines.forEach(l => {
                              pq[l.item_id] = l.physical_quantity;
                              ln[l.item_id] = l.notes || '';
                            });
                            setPhysicalQuantities(pq);
                            setLineNotes(ln);
                          }}
                          className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Session Detail Editor Panel */}
        {selectedCount && (
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 shadow-sm rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-start border-b border-slate-150 dark:border-slate-800 pb-3">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <ClipboardList size={14} className="text-teal-500" />
                  <span>تفاصيل محضر الجرد والتدقيق الفعلي</span>
                </div>
                <h3 className="font-mono text-lg font-black text-slate-800 dark:text-slate-100">{selectedCount.count_no}</h3>
              </div>
              <button onClick={() => setSelectedCount(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">✕</button>
            </div>

            {/* Session Specs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-slate-400 dark:text-slate-500 block">المستودع المجرد</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{db.warehouses.find(w => w.id === selectedCount.warehouse_id)?.name}</span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 block">التاريخ</span>
                <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">{selectedCount.count_date}</span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 block">بواسطة</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{selectedCount.created_by}</span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 block">الحالة</span>
                <span>{getStatusBadge(selectedCount.status)}</span>
              </div>
            </div>

            {/* Lines Editor Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">الأصناف الدفترية والفروقات الفعلية الموثقة:</h4>
              
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-[350px] overflow-y-auto">
                {/* Header row */}
                <div className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 dark:text-slate-400 p-2.5 grid grid-cols-12 text-center">
                  <span className="col-span-5 text-right">الصنف</span>
                  <span className="col-span-2">الرصيد الدفتري</span>
                  <span className="col-span-3">العد الفعلي</span>
                  <span className="col-span-2">الفرق الكمي</span>
                </div>

                {/* Items loop */}
                {selectedCount.lines.map((line) => {
                  const item = db.items.find(it => it.id === line.item_id);
                  const isEditing = selectedCount.status === 'DRAFT' && user.role !== 'VIEWER';
                  const physicalVal = physicalQuantities[line.item_id] !== undefined ? physicalQuantities[line.item_id] : line.physical_quantity;
                  const diff = physicalVal - line.book_quantity;

                  return (
                    <div key={line.id} className="p-2.5 grid grid-cols-12 items-center text-xs text-center hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <div className="col-span-5 text-right space-y-0.5 min-w-0">
                        <span className="font-bold text-slate-700 dark:text-slate-300 block truncate">{item?.name_ar}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">SKU: {item?.sku}</span>
                      </div>
                      
                      {/* Book stock */}
                      <span className="col-span-2 font-mono font-bold text-slate-700 dark:text-slate-300">{line.book_quantity}</span>
                      
                      {/* Physical count input */}
                      <div className="col-span-3 px-2 flex justify-center">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={physicalVal}
                            onChange={(e) => handlePhysicalQtyChange(line.item_id, Number(e.target.value))}
                            className="w-20 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded p-1 text-center font-bold text-slate-800 dark:text-slate-100"
                          />
                        ) : (
                          <span className="font-bold text-slate-800 dark:text-slate-200">{line.physical_quantity}</span>
                        )}
                      </div>

                      {/* Calculated difference */}
                      <span className={`col-span-2 font-mono font-black text-sm ${diff === 0 ? 'text-slate-400 dark:text-slate-500' : diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {diff > 0 ? `+${diff}` : diff}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Notes if any */}
            {selectedCount.notes && (
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-150 dark:border-slate-800 rounded text-xs text-slate-600 dark:text-slate-300">
                <span className="text-slate-400 dark:text-slate-500 block font-semibold mb-0.5">ملاحظات الجرد العامة:</span>
                <p>{selectedCount.notes}</p>
              </div>
            )}

            {/* Action buttons */}
            {selectedCount.status === 'DRAFT' && user.role !== 'VIEWER' && (
              <div className="pt-4 border-t border-slate-150 dark:border-slate-800 flex justify-between gap-3">
                {canManage && (
                  <button
                    onClick={() => handleCancelSession(selectedCount.id)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-lg transition-all cursor-pointer"
                  >
                    إلغاء محضر الجلسة
                  </button>
                )}
                <div className="flex gap-2 mr-auto">
                  <button
                    onClick={handleSaveDraftChanges}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Save size={14} />
                    حفظ التغييرات المؤقتة
                  </button>
                  {canManage && (
                    <button
                      onClick={() => handleApproveSession(selectedCount.id)}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <Check size={14} />
                      اعتماد الجرد والترحيل النهائي
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-150 dark:border-slate-800 p-4 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">تثبيت وفتح محضر جرد جديد</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateSession} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">المستودع المراد جرده</label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(Number(e.target.value))}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  {db.warehouses.filter(w => w.is_active).map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block leading-normal mt-1">
                  تنبيه: سيقوم النظام بتثبيت الرصيد الدفتري الحالي لجميع الأصناف المفعّلة بالمستودع المختار كخط أساس للعد الفعلي.
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">ملاحظات وتوجيهات الجرد</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: جرد نهاية ربع العام أو جرد عشوائي للتحقق..."
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-150 dark:border-slate-800 pt-4 mt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
                >
                  تثبيت وبدء الجلسة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
