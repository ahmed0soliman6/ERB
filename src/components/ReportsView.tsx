import React, { useState } from 'react';
import { BarChart2, Calendar, Clipboard, AlertTriangle } from 'lucide-react';
import { DBSchema, Item } from '../data/db';

interface ReportsViewProps {
  db: DBSchema;
  user: any;
  stockBalances: Record<string, number>; // `${itemId}-${warehouseId}`
}

export const ReportsView: React.FC<ReportsViewProps> = ({ db, user, stockBalances }) => {
  const [activeSubTab, setActiveSubTab] = useState<'BALANCES' | 'ITEM_LEDGER' | 'PERIODIC' | 'LOW_STOCK'>('BALANCES');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number>(1);
  const [selectedItemId, setSelectedItemId] = useState<number>(1);
  const [startDate, setStartDate] = useState<string>('2026-09-01');
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const getFilteredWarehouses = () => {
    if (user.role !== 'ADMIN' && user.allowed_warehouses.length > 0) {
      return db.warehouses.filter(w => user.allowed_warehouses.includes(w.id));
    }
    return db.warehouses;
  };

  const getDocTypeAr = (type: string) => {
    switch (type) {
      case 'OPENING': return 'رصيد افتتاحي';
      case 'RECEIPT': return 'مستند توريد';
      case 'TRANSFER_IN': return 'تحويل (دخول)';
      case 'TRANSFER_OUT': return 'تحويل (خروج)';
      case 'ISSUE': return 'مستند صرف';
      case 'CONSUMPTION': return 'مستند استهلاك';
      case 'COUNT_ADJUSTMENT_IN': return 'تسوية زيادة جرد';
      case 'COUNT_ADJUSTMENT_OUT': return 'تسوية عجز جرد';
      default: return 'حركة مخزنية';
    }
  };

  // 1. Current Balances Report calculation
  const getWarehouseBalances = () => {
    return db.items.map((item) => {
      const bal = stockBalances[`${item.id}-${selectedWarehouseId}`] || 0;
      return { item, balance: bal };
    });
  };

  // 2. Item Movement Ledger Timeline calculation
  const getItemMovementLedger = () => {
    let movs = db.movements.filter(m => m.item_id === selectedItemId);
    
    if (user.role !== 'ADMIN' && user.allowed_warehouses.length > 0) {
      movs = movs.filter(m => user.allowed_warehouses.includes(m.warehouse_id));
    }

    movs.sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

    let runningBal = 0;
    const ledger = movs.map((m) => {
      runningBal += m.signed_quantity;
      return {
        ...m,
        running_balance: runningBal
      };
    });

    return ledger.reverse();
  };

  // 3. Periodic report calculation
  const getPeriodicMovements = () => {
    let movs = db.movements;
    movs = movs.filter(m => m.warehouse_id === selectedWarehouseId);
    movs = movs.filter(m => {
      const d = m.occurred_at.split('T')[0];
      return d >= startDate && d <= endDate;
    });

    return movs.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
  };

  // 4. Low stock items calculation
  const getLowStockItems = () => {
    const lowStockList: { item: Item; warehouse: any; balance: number }[] = [];
    db.warehouses.forEach(w => {
      if (user.role !== 'ADMIN' && user.allowed_warehouses.length > 0 && !user.allowed_warehouses.includes(w.id)) {
        return;
      }
      db.items.forEach(item => {
        const hasMovement = db.movements.some(m => m.item_id === item.id && m.warehouse_id === w.id);
        if (!hasMovement) return;
        const bal = stockBalances[`${item.id}-${w.id}`] || 0;
        if (bal <= item.minimum_stock) {
          lowStockList.push({ item, warehouse: w, balance: bal });
        }
      });
    });
    return lowStockList;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">التقارير التحليلية وسجل الحركات المخزنية</h2>
        <p className="text-slate-500 dark:text-slate-400 text-xs">مراجعة كشوفات الأرصدة الحالية، بطاقة حركة الصنف التاريخية، والتدقيق الكمي.</p>
      </div>

      {/* Navigation SubTabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('BALANCES')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeSubTab === 'BALANCES' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          أرصدة المستودعات الحالية
        </button>
        <button
          onClick={() => setActiveSubTab('ITEM_LEDGER')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeSubTab === 'ITEM_LEDGER' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          بطاقة حركة الصنف الموحدة
        </button>
        <button
          onClick={() => setActiveSubTab('PERIODIC')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeSubTab === 'PERIODIC' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          حركات فترة زمنية محددة
        </button>
        <button
          onClick={() => setActiveSubTab('LOW_STOCK')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeSubTab === 'LOW_STOCK' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          الأصناف تحت حد الأمان الأدنى
        </button>
      </div>

      {/* Filter Options depend on active subtab */}
      <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 items-end text-xs font-bold text-slate-600 dark:text-slate-300">
        {(activeSubTab === 'BALANCES' || activeSubTab === 'PERIODIC') && (
          <div className="space-y-1.5">
            <span>تصفية حسب المستودع المعتمد:</span>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(Number(e.target.value))}
              className="w-52 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl p-2 text-xs text-slate-800 dark:text-slate-100"
            >
              {getFilteredWarehouses().map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        )}

        {activeSubTab === 'ITEM_LEDGER' && (
          <div className="space-y-1.5">
            <span>اختر الصنف المراد سحب حركته:</span>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(Number(e.target.value))}
              className="w-72 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl p-2 text-xs text-slate-800 dark:text-slate-100"
            >
              {db.items.map(it => <option key={it.id} value={it.id}>{it.name_ar} ({it.sku})</option>)}
            </select>
          </div>
        )}

        {activeSubTab === 'PERIODIC' && (
          <>
            <div className="space-y-1.5">
              <span>تاريخ البداية:</span>
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl p-2 text-xs text-slate-800 dark:text-slate-100" 
              />
            </div>
            <div className="space-y-1.5">
              <span>تاريخ النهاية:</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl p-2 text-xs text-slate-800 dark:text-slate-100" 
              />
            </div>
          </>
        )}

        <button 
          onClick={() => window.print()}
          className="mr-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl flex items-center gap-1.5 font-bold shadow-sm transition-all text-xs"
        >
          <Clipboard size={14} />
          تصدير التقرير وطباعته (PDF)
        </button>
      </div>

      {/* --- SUBTAB 1: BALANCES REPORT --- */}
      {activeSubTab === 'BALANCES' && (
        <div className="space-y-6">
          {/* Custom Responsive Stock Level Indicators */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-1.5">
              <BarChart2 className="text-blue-500" size={16} />
              مؤشرات الأرصدة والكميات الفعلية للمستودع المحدد
            </h4>
            
            <div className="space-y-3">
              {getWarehouseBalances().slice(0, 5).map(({ item, balance }) => {
                const maxVal = Math.max(...getWarehouseBalances().map(b => b.balance), 500);
                const pct = (balance / maxVal) * 100;
                return (
                  <div key={item.id} className="grid grid-cols-12 items-center gap-3 text-xs">
                    <span className="col-span-4 font-semibold text-slate-700 dark:text-slate-300 truncate">{item.name_ar}</span>
                    <div className="col-span-6 bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${balance <= item.minimum_stock ? 'bg-amber-500' : 'bg-blue-600'}`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                    <span className="col-span-2 text-left font-black text-slate-800 dark:text-slate-200 font-mono">
                      {balance} {db.units.find(u => u.id === item.base_unit_id)?.name_ar}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Table representing all balances */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs border-b border-slate-100 dark:border-slate-800">
                  <th className="p-4">الرمز SKU</th>
                  <th className="p-4">اسم الصنف بالكامل</th>
                  <th className="p-4 text-center">الرصيد الفعلي الحالي</th>
                  <th className="p-4 text-center">رصيد أمان الطلب</th>
                  <th className="p-4 text-center">حالة المخزون</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm text-slate-700 dark:text-slate-300">
                {getWarehouseBalances().map(({ item, balance }) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-4 font-mono font-bold text-slate-800 dark:text-slate-100 text-xs">{item.sku}</td>
                    <td className="p-4 font-semibold text-slate-800 dark:text-slate-100">{item.name_ar}</td>
                    <td className="p-4 text-center font-black text-slate-800 dark:text-slate-100 font-mono text-sm">{balance}</td>
                    <td className="p-4 font-bold text-slate-600 dark:text-slate-400 text-center font-mono">{item.minimum_stock}</td>
                    <td className="p-4 text-center">
                      {balance === 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400 text-xs font-bold bg-red-50 dark:bg-red-950/60 px-2.5 py-1 rounded-full border border-red-100 dark:border-red-900/60">نفذ تماماً</span>
                      ) : balance <= item.minimum_stock ? (
                        <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-bold bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-full border border-amber-100 dark:border-amber-900/60">تحت حد الطلب</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-100 dark:border-emerald-900/60">آمن ومكتمل</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- SUBTAB 2: ITEM MOVEMENT LEDGER (بطاقة الصنف) --- */}
      {activeSubTab === 'ITEM_LEDGER' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden p-5 space-y-4">
          <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Clipboard className="text-blue-500" size={16} />
            سجل الحركات التاريخية والتدقيق الممنهج (بطاقة حركة صنف)
          </h4>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs border-b border-slate-100 dark:border-slate-800">
                  <th className="p-3">رقم الحركة</th>
                  <th className="p-3">نوع العملية</th>
                  <th className="p-3">المستودع</th>
                  <th className="p-3 text-center">اتجاه الحركة</th>
                  <th className="p-3 text-center">الكمية المقيدة</th>
                  <th className="p-3 text-center">الرصيد التراكمي المتبقي</th>
                  <th className="p-3">التوقيت والتاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
                {getItemMovementLedger().length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
                      لا توجد حركات مخزنية معتمدة ومرحلة لهذا الصنف حالياً.
                    </td>
                  </tr>
                ) : (
                  getItemMovementLedger().map((m) => {
                    const warehouse = db.warehouses.find(w => w.id === m.warehouse_id);
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 font-semibold">
                        <td className="p-3 font-mono text-slate-800 dark:text-slate-200">{m.movement_no}</td>
                        <td className="p-3">{getDocTypeAr(m.movement_type)}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">{warehouse?.name}</td>
                        <td className="p-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded font-bold text-[10px] ${m.direction === 'IN' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300'}`}>
                            {m.direction === 'IN' ? 'وارد (إيداع)' : 'صادر (سحب)'}
                          </span>
                        </td>
                        <td className={`p-3 text-center font-mono font-bold text-sm ${m.direction === 'IN' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {m.direction === 'IN' ? '+' : '-'}{m.quantity}
                        </td>
                        <td className="p-3 text-center font-mono font-black text-slate-800 dark:text-slate-100 text-sm">{m.running_balance}</td>
                        <td className="p-3 text-slate-400 dark:text-slate-500 text-[10px]">{new Date(m.occurred_at).toLocaleString('ar-EG')}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- SUBTAB 3: PERIODIC MOVEMENTS --- */}
      {activeSubTab === 'PERIODIC' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden p-5 space-y-4">
          <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Calendar className="text-blue-500" size={16} />
            قائمة حركات الفترة المعتمدة للمستودع ({db.warehouses.find(w => w.id === selectedWarehouseId)?.name})
          </h4>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs border-b border-slate-100 dark:border-slate-800">
                  <th className="p-3">رقم الحركة</th>
                  <th className="p-3">الصنف</th>
                  <th className="p-3">نوع الحركة</th>
                  <th className="p-3 text-center">الكمية</th>
                  <th className="p-3">الملاحظات</th>
                  <th className="p-3">تاريخ وقوع الحركة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
                {getPeriodicMovements().length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
                      لا توجد حركات مسجلة تقع ضمن النطاق الزمني والمستودع المختارين.
                    </td>
                  </tr>
                ) : (
                  getPeriodicMovements().map((m) => {
                    const item = db.items.find(i => i.id === m.item_id);
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200">{m.movement_no}</td>
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{item?.name_ar} ({item?.sku})</td>
                        <td className="p-3 font-semibold">{getDocTypeAr(m.movement_type)}</td>
                        <td className={`p-3 text-center font-mono font-black text-sm ${m.direction === 'IN' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {m.direction === 'IN' ? '+' : '-'}{m.quantity}
                        </td>
                        <td className="p-3 text-slate-500 dark:text-slate-400 text-[11px] max-w-xs truncate">{m.notes || 'بدون ملاحظات'}</td>
                        <td className="p-3 text-slate-400 dark:text-slate-500 text-[10px]">{new Date(m.occurred_at).toLocaleString('ar-EG')}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- SUBTAB 4: LOW STOCK WARNINGS --- */}
      {activeSubTab === 'LOW_STOCK' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <AlertTriangle className="text-amber-500" size={18} />
            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">الأصناف التي بلغت أو تخطت حد الطلب الأدنى</h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs border-b border-slate-100 dark:border-slate-800">
                  <th className="p-4">مستودع العجز</th>
                  <th className="p-4">الرمز SKU</th>
                  <th className="p-4">اسم الصنف بالكامل</th>
                  <th className="p-4 text-center">الرصيد الفعلي الحالي</th>
                  <th className="p-4 text-center">حد الأمان المعتمد</th>
                  <th className="p-4 text-center">كمية العجز المخزنية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm text-slate-700 dark:text-slate-300">
                {getLowStockItems().length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 dark:text-slate-500">
                      ✅ جميع الأصناف رصيدها سليم ومتجاوز لحد الأمان في كافة المستودعات المحددة.
                    </td>
                  </tr>
                ) : (
                  getLowStockItems().map(({ item, warehouse, balance }, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-bold text-slate-700 dark:text-slate-300">{warehouse.name}</td>
                      <td className="p-4 font-mono text-slate-500 dark:text-slate-400 text-xs">{item.sku}</td>
                      <td className="p-4 font-semibold text-slate-800 dark:text-slate-100">{item.name_ar}</td>
                      <td className="p-4 text-center font-black text-red-600 dark:text-red-400 font-mono">{balance}</td>
                      <td className="p-4 text-center font-bold text-slate-600 dark:text-slate-400 font-mono">{item.minimum_stock}</td>
                      <td className="p-4 text-center font-black text-amber-600 dark:text-amber-400 font-mono">{item.minimum_stock - balance}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
