import React, { useState } from 'react';
import { 
  Package, AlertTriangle, ArrowUpRight, ArrowDownLeft, RefreshCw, 
  BarChart2, CheckCircle, Database, ChevronLeft, CalendarX, ShieldAlert,
  Clock, ArrowRight
} from 'lucide-react';
import { DBSchema } from '../data/db';
import { computeSmartNotifications } from '../utils/alertEngine';

interface DashboardProps {
  db: DBSchema;
  user: any;
  onNavigate: (view: string) => void;
  stockBalances: Record<string, number>;
}

export const DashboardView: React.FC<DashboardProps> = ({ db, user, onNavigate, stockBalances }) => {
  const [activeAlertTab, setActiveAlertTab] = useState<'REORDER' | 'EXPIRY'>('REORDER');

  // Compute stats
  const activeItemsCount = db.items.filter(i => i.is_active).length;
  const activeWarehousesCount = db.warehouses.filter(w => w.is_active).length;
  const pendingDocsCount = db.documents.filter(d => d.status === 'DRAFT').length;

  // Compute live smart alerts
  const smartNotifications = computeSmartNotifications(
    db,
    stockBalances,
    user.role,
    user.allowed_warehouses
  );

  const reorderAlerts = smartNotifications.reorderAlerts;
  const expiryAlerts = smartNotifications.expiryAlerts;

  // Recent 5 movements
  const recentMovements = [...db.movements]
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, 5);

  const getMovementLabel = (type: string) => {
    switch (type) {
      case 'OPENING': return 'رصيد افتتاحي';
      case 'RECEIPT': return 'توريد مستند';
      case 'TRANSFER_IN': return 'تحويل (دخول)';
      case 'TRANSFER_OUT': return 'تحويل (خروج)';
      case 'ISSUE': return 'صرف لقسم';
      case 'CONSUMPTION': return 'استهلاك عيادة';
      case 'COUNT_ADJUSTMENT_IN': return 'تسوية زيادة';
      case 'COUNT_ADJUSTMENT_OUT': return 'تسوية عجز';
      default: return 'حركة مخزنية';
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Welcome header */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-800 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 transform translate-x-12 -translate-y-12 opacity-10 pointer-events-none">
          <Database size={240} />
        </div>
        <div className="relative z-10 space-y-2">
          <h1 className="text-2xl font-bold">مرحباً بك، {user.display_name} 👋</h1>
          <p className="text-blue-100 max-w-xl text-sm leading-relaxed">
            نظام SoliMedical-ERB لإدارة وتتبع المخازن الطبية والأدوية. ينبهك النظام فورياً عند اقتراب الأصناف من حد الطلب أو اقتراب تاريخ انتهاء الصلاحية.
          </p>
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-3.5 py-1 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>الدور الحالي: <strong className="font-bold text-white">{user.role}</strong></span>
          </div>
        </div>
      </div>

      {/* Grid of Key Interactive Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Items */}
        <button
          onClick={() => onNavigate('items')}
          className="group text-right bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-500 dark:hover:border-blue-500 transition-all duration-200 focus:outline-none cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold block">إجمالي الأصناف المفعّلة</span>
              <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{activeItemsCount}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
              <Package size={22} />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-blue-600 dark:text-blue-400 font-bold">
            <span>دليل الأصناف والكتالوج</span>
            <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          </div>
        </button>

        {/* Card 2: Warehouses */}
        <button
          onClick={() => onNavigate('reports')}
          className="group text-right bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-emerald-500 dark:hover:border-emerald-500 transition-all duration-200 focus:outline-none cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold block">المستودعات النشطة</span>
              <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{activeWarehousesCount}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <Database size={22} />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
            <span>تقرير أرصدة المستودعات</span>
            <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          </div>
        </button>

        {/* Card 3: Reorder Alerts */}
        <button
          onClick={() => {
            setActiveAlertTab('REORDER');
            onNavigate('items');
          }}
          className="group text-right bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-amber-500 dark:hover:border-amber-500 transition-all duration-200 focus:outline-none cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold block">تنبيهات حد الطلب</span>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">{reorderAlerts.length}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <AlertTriangle size={22} />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-amber-600 dark:text-amber-400 font-bold">
            <span>مراجعة الأصناف الناقصة</span>
            <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          </div>
        </button>

        {/* Card 4: Expiry Alerts */}
        <button
          onClick={() => {
            setActiveAlertTab('EXPIRY');
            onNavigate('reports');
          }}
          className="group text-right bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-rose-500 dark:hover:border-rose-500 transition-all duration-200 focus:outline-none cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold block">تنبيهات صلاحية الأدوية</span>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">{expiryAlerts.length}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
              <CalendarX size={22} />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-rose-600 dark:text-rose-400 font-bold">
            <span>كشف الأدوية المنتهية</span>
            <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          </div>
        </button>

        {/* Card 5: Pending Docs */}
        <button
          onClick={() => onNavigate('documents')}
          className="group text-right bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-purple-500 dark:hover:border-purple-500 transition-all duration-200 focus:outline-none cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold block">مستندات بانتظار الاعتماد</span>
              <div className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">{pendingDocsCount}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
              <CheckCircle size={22} />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-purple-600 dark:text-purple-400 font-bold">
            <span>الانتقال للاعتماد والتسجيل</span>
            <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          </div>
        </button>
      </div>

      {/* Main Grid: Smart Notification Center Widget + Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SMART NOTIFICATION WIDGET */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm">
              <ShieldAlert className="text-amber-500" size={20} />
              شريط التنبيهات الفورية
            </h3>
            <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
              <span>نشط حياً</span>
            </div>
          </div>

          {/* Interactive Alert Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveAlertTab('REORDER')}
              className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeAlertTab === 'REORDER'
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              حد الطلب ({reorderAlerts.length})
            </button>
            <button
              onClick={() => setActiveAlertTab('EXPIRY')}
              className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeAlertTab === 'EXPIRY'
                  ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              الصلاحيات ({expiryAlerts.length})
            </button>
          </div>

          {/* Tab 1: Reorder Level Alerts */}
          {activeAlertTab === 'REORDER' && (
            <div className="space-y-3 overflow-y-auto max-h-[350px] pr-0.5">
              {reorderAlerts.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs">
                  ✅ جميع الأصناف رصيدها سليم ومتجاوز لحد الطلب الآمن.
                </div>
              ) : (
                reorderAlerts.map((al) => (
                  <div 
                    key={al.id} 
                    className={`p-3.5 rounded-xl border flex flex-col space-y-2 transition-all ${
                      al.severity === 'CRITICAL'
                        ? 'bg-red-50/70 dark:bg-red-950/20 border-red-200/80 dark:border-red-900/50'
                        : 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-900/50'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-1">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs sm:text-sm block">{al.itemName}</span>
                        <span className="text-[10px] text-slate-400 font-mono font-normal">({al.sku})</span>
                      </div>
                      <span className="text-[10px] bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-bold shrink-0">
                        {al.warehouseName}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400 font-mono">
                      <span>الرصيد الفعلي: <strong className="text-red-600 dark:text-red-400 font-bold text-sm">{al.currentStock}</strong> {al.unitName}</span>
                      <span>حد الأمان: <strong className="text-slate-700 dark:text-slate-300 font-bold">{al.minimumStock}</strong></span>
                    </div>

                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${al.currentStock === 0 ? 'bg-red-600' : 'bg-amber-500'}`}
                        style={{ width: `${Math.min(100, (al.currentStock / al.minimumStock) * 100)}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t border-slate-200/50 dark:border-slate-800 text-[10px]">
                      <span className="text-rose-600 dark:text-rose-400 font-bold">العجز المطلوب: +{al.deficit} {al.unitName}</span>
                      <button
                        onClick={() => onNavigate('documents')}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2 py-0.5 rounded flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <ArrowDownLeft size={12} />
                        طلب توريد
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 2: Medicine Expiry Alerts */}
          {activeAlertTab === 'EXPIRY' && (
            <div className="space-y-3 overflow-y-auto max-h-[350px] pr-0.5">
              {expiryAlerts.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs">
                  ✅ جميع الأدوية والمستلزمات ذات صلاحية سارية.
                </div>
              ) : (
                expiryAlerts.map((exp) => (
                  <div 
                    key={exp.id} 
                    className={`p-3.5 rounded-xl border flex flex-col space-y-2 transition-all ${
                      exp.type === 'EXPIRED'
                        ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200/80 dark:border-rose-900/60'
                        : exp.type === 'EXPIRING_CRITICAL'
                        ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-900/60'
                        : 'bg-yellow-50/80 dark:bg-yellow-950/20 border-yellow-200/80 dark:border-yellow-900/50'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-1">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs sm:text-sm block">{exp.itemName}</span>
                        <span className="text-[10px] text-slate-400 font-mono font-normal">تشغيلة: {exp.batchNo}</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-black text-white ${
                        exp.type === 'EXPIRED' ? 'bg-red-600' : 'bg-amber-600'
                      }`}>
                        {exp.type === 'EXPIRED' ? 'منتهي الصلاحية' : 'قريب الانتهاء'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400 font-mono">
                      <span>تاريخ الانتهاء: <strong className="text-slate-800 dark:text-slate-200 font-bold">{exp.expiryDate}</strong></span>
                      <span>الكمية: <strong className="text-slate-800 dark:text-slate-200 font-bold">{exp.quantity} {exp.unitName}</strong></span>
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t border-slate-200/50 dark:border-slate-800 text-[10px]">
                      <span className={`font-bold font-mono px-2 py-0.5 rounded ${
                        exp.daysRemaining < 0 
                          ? 'bg-red-200 text-red-900 dark:bg-red-900/80 dark:text-red-100' 
                          : 'bg-amber-200 text-amber-900 dark:bg-amber-900/80 dark:text-amber-100'
                      }`}>
                        {exp.daysRemaining < 0 ? `منتهي منذ ${Math.abs(exp.daysRemaining)} يوم` : `متبقي ${exp.daysRemaining} يوم`}
                      </span>

                      {exp.daysRemaining < 0 ? (
                        <button
                          onClick={() => onNavigate('counts')}
                          className="bg-red-600 hover:bg-red-700 text-white font-bold px-2 py-0.5 rounded flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <CalendarX size={12} />
                          استبعاد الجرد
                        </button>
                      ) : (
                        <button
                          onClick={() => onNavigate('documents')}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-2 py-0.5 rounded flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <RefreshCw size={12} />
                          تحويل/صرف
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Recent Transactions List */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm">
              <RefreshCw className="text-blue-500" size={18} />
              آخر الحركات المخزنية المسجلة
            </h3>
            <button 
              onClick={() => onNavigate('reports')} 
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer"
            >
              عرض الكل بالتقارير
            </button>
          </div>

          <div className="space-y-2.5">
            {recentMovements.length === 0 ? (
              <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
                لا توجد حركات مسجلة حالياً. قم بإدخال واعتماد مستند توريد أو تحويل.
              </div>
            ) : (
              recentMovements.map((m) => {
                const item = db.items.find(i => i.id === m.item_id);
                const warehouse = db.warehouses.find(w => w.id === m.warehouse_id);
                return (
                  <div 
                    key={m.id} 
                    onClick={() => onNavigate('reports')}
                    className="p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl shrink-0 ${m.direction === 'IN' ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400'}`}>
                        {m.direction === 'IN' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                      </div>
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">{item?.name_ar || 'صنف غير معروف'}</div>
                        <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-2">
                          <span>{warehouse?.name}</span>
                          <span>•</span>
                          <span>{getMovementLabel(m.movement_type)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-left space-y-1">
                      <div className={`font-black font-mono text-sm ${m.direction === 'IN' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {m.direction === 'IN' ? '+' : '-'}{m.quantity}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                        {new Date(m.occurred_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Action Quick Links */}
      <div className="bg-slate-100 dark:bg-slate-900/70 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">روابط الإجراءات السريعة</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button 
            onClick={() => onNavigate('items')} 
            className="p-3.5 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500 rounded-xl text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold flex flex-col items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <Package className="text-indigo-600 dark:text-indigo-400 mb-0.5" size={20} />
            دليل الأصناف والكتالوج
          </button>
          {user.role !== 'VIEWER' && (
            <>
              <button 
                onClick={() => onNavigate('documents')} 
                className="p-3.5 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500 rounded-xl text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold flex flex-col items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                <ArrowDownLeft className="text-emerald-600 dark:text-emerald-400 mb-0.5" size={20} />
                مستند توريد جديد
              </button>
              <button 
                onClick={() => onNavigate('documents')} 
                className="p-3.5 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500 rounded-xl text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold flex flex-col items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                <RefreshCw className="text-blue-600 dark:text-blue-400 mb-0.5" size={20} />
                تحويل مخزني جديد
              </button>
            </>
          )}
          <button 
            onClick={() => onNavigate('reports')} 
            className="p-3.5 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500 rounded-xl text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold flex flex-col items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <BarChart2 className="text-purple-600 dark:text-purple-400 mb-0.5" size={20} />
            تقارير الأرصدة والتحليلات
          </button>
        </div>
      </div>
    </div>
  );
};
