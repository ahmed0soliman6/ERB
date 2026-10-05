import React, { useState } from 'react';
import { 
  Bell, AlertTriangle, CalendarX, ArrowDownLeft, RefreshCw, 
  ChevronLeft, X, Filter, Download, Package, ShieldAlert, CheckCircle2, Clock
} from 'lucide-react';
import { DBSchema } from '../data/db';
import { computeSmartNotifications, StockAlert, ExpiryAlert } from '../utils/alertEngine';

interface NotificationCenterProps {
  db: DBSchema;
  user: any;
  stockBalances: Record<string, number>;
  onNavigate: (view: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  db,
  user,
  stockBalances,
  onNavigate
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'REORDER' | 'EXPIRY'>('ALL');
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [searchTerm, setSearchQuery] = useState('');

  // Compute live smart alerts
  const rawSummary = computeSmartNotifications(
    db,
    stockBalances,
    user.role,
    user.allowed_warehouses
  );

  // Filter out dismissed notifications
  const activeReorderAlerts = rawSummary.reorderAlerts.filter(a => !dismissedIds.includes(a.id));
  const activeExpiryAlerts = rawSummary.expiryAlerts.filter(a => !dismissedIds.includes(a.id));

  // Search filtering
  const filteredReorder = activeReorderAlerts.filter(a => 
    !searchTerm.trim() || 
    a.itemName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.warehouseName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredExpiry = activeExpiryAlerts.filter(a => 
    !searchTerm.trim() || 
    a.itemName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.batchNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.warehouseName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalActiveCount = activeReorderAlerts.length + activeExpiryAlerts.length;
  const criticalCount = activeReorderAlerts.filter(a => a.severity === 'CRITICAL').length + 
                       activeExpiryAlerts.filter(a => a.severity === 'CRITICAL').length;

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedIds(prev => [...prev, id]);
  };

  const handleDismissAll = () => {
    const allIds = [...activeReorderAlerts.map(a => a.id), ...activeExpiryAlerts.map(a => a.id)];
    setDismissedIds(prev => [...prev, ...allIds]);
  };

  const handleExportAlertsCSV = () => {
    const headers = ['نوع التنبيه', 'درجة الأهمية', 'اسم الصنف', 'الكود SKU', 'المستودع', 'التفاصيل والتشغيلة', 'الإجراء المطلوب'];
    const rows: string[][] = [];

    activeReorderAlerts.forEach(r => {
      rows.push([
        r.type === 'OUT_OF_STOCK' ? 'نفاد مخزون' : 'حد الطلب',
        r.severity === 'CRITICAL' ? 'حرج جـداً' : 'تحذير',
        `"${r.itemName}"`,
        r.sku,
        `"${r.warehouseName}"`,
        `الرصيد: ${r.currentStock} ${r.unitName} (حد الأمان: ${r.minimumStock})`,
        'إصدار إذن توريد عاجل'
      ]);
    });

    activeExpiryAlerts.forEach(x => {
      rows.push([
        x.type === 'EXPIRED' ? 'منتهي الصلاحية' : 'قريب الانتهاء',
        x.severity === 'CRITICAL' ? 'حرج جـداً' : 'تنبيه',
        `"${x.itemName}"`,
        x.sku,
        `"${x.warehouseName}"`,
        `تشغيلة: ${x.batchNo} - تاريخ: ${x.expiryDate} (${x.daysRemaining < 0 ? 'منتهي' : `متبقي ${x.daysRemaining} يوم`})`,
        x.daysRemaining < 0 ? 'إعدام واستبعاد' : 'صرف سريع قبل الانتهاء'
      ]);
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `تقرير_التنبيهات_الفورية_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Live Header Notification Bell Button */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/80 transition-all flex items-center justify-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          title="شريط التنبيهات الفورية الذكية"
        >
          <Bell size={18} className={totalActiveCount > 0 ? 'text-amber-500 animate-bounce' : ''} />
          
          {totalActiveCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md">
              {totalActiveCount > 99 ? '99+' : totalActiveCount}
            </span>
          )}
        </button>

        {/* Dropdown Panel / Slide Over */}
        {isOpen && (
          <>
            {/* Backdrop for closing */}
            <div 
              className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px]" 
              onClick={() => setIsOpen(false)} 
            />

            {/* Notification Drawer */}
            <div className="absolute left-0 md:left-0 top-12 z-50 w-[92vw] sm:w-[420px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden font-sans text-right animate-in fade-in slide-in-from-top-2 duration-200">
              
              {/* Header */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
                    <ShieldAlert size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm leading-none">مركز الإشعارات والتنبيهات الفورية</h3>
                    <p className="text-[10px] text-slate-400 mt-1">تنبيهات حد الطلب والصلاحيات المحدثة حياً</p>
                  </div>
                </div>

                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Status Bar */}
              <div className="bg-slate-100 dark:bg-slate-800/80 p-2.5 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    <span>حرجة: <strong className="text-red-600 dark:text-red-400 font-mono">{criticalCount}</strong></span>
                  </span>
                  <span>•</span>
                  <span>إجمالي الإشعارات: <strong className="text-slate-900 dark:text-slate-100 font-mono">{totalActiveCount}</strong></span>
                </div>

                {totalActiveCount > 0 && (
                  <button 
                    onClick={handleExportAlertsCSV}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Download size={13} />
                    تصدير
                  </button>
                )}
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold">
                <button
                  onClick={() => setActiveTab('ALL')}
                  className={`flex-1 py-2.5 text-center transition-all cursor-pointer border-b-2 ${
                    activeTab === 'ALL'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  الكل ({totalActiveCount})
                </button>
                <button
                  onClick={() => setActiveTab('REORDER')}
                  className={`flex-1 py-2.5 text-center transition-all cursor-pointer border-b-2 ${
                    activeTab === 'REORDER'
                      ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-800'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  حد الطلب ({activeReorderAlerts.length})
                </button>
                <button
                  onClick={() => setActiveTab('EXPIRY')}
                  className={`flex-1 py-2.5 text-center transition-all cursor-pointer border-b-2 ${
                    activeTab === 'EXPIRY'
                      ? 'border-red-500 text-red-600 dark:text-red-400 bg-white dark:bg-slate-800'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  الصلاحيات ({activeExpiryAlerts.length})
                </button>
              </div>

              {/* Search Filter */}
              <div className="p-2 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="فلترة التنبيهات باسم الصنف، الكود، أو التشغيلة..."
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* List Content */}
              <div className="max-h-[380px] overflow-y-auto p-3 space-y-2.5 divide-y divide-slate-100 dark:divide-slate-800/60">
                {totalActiveCount === 0 ? (
                  <div className="text-center py-10 space-y-2 text-slate-400">
                    <CheckCircle2 className="mx-auto text-emerald-500" size={36} />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">لا توجد تنبيهات حرجـة حالياً!</p>
                    <p className="text-[10px] text-slate-400">جميع أرصدة المستودعات آمنة والصلاحيات سارية.</p>
                  </div>
                ) : (
                  <>
                    {/* Render Reorder Alerts */}
                    {(activeTab === 'ALL' || activeTab === 'REORDER') && filteredReorder.map(alert => (
                      <div 
                        key={alert.id}
                        className={`p-3 rounded-xl border transition-all text-xs space-y-1.5 ${
                          alert.severity === 'CRITICAL'
                            ? 'bg-red-50/80 dark:bg-red-950/30 border-red-200 dark:border-red-900/60'
                            : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              alert.type === 'OUT_OF_STOCK' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
                            }`}>
                              {alert.type === 'OUT_OF_STOCK' ? 'نفاد مخزون' : 'حد الطلب'}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-slate-100">{alert.itemName}</span>
                          </div>

                          <button 
                            onClick={(e) => handleDismiss(alert.id, e)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                            title="تجاهل هذا الإشعار"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        <div className="flex justify-between items-center text-[11px] text-slate-600 dark:text-slate-400">
                          <span>المستودع: <strong className="text-slate-800 dark:text-slate-200">{alert.warehouseName}</strong></span>
                          <span>الرصيد: <strong className="font-mono font-bold text-red-600 dark:text-red-400 text-xs">{alert.currentStock}</strong> / أدنى: {alert.minimumStock} {alert.unitName}</span>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-800">
                          <button
                            onClick={() => {
                              setIsOpen(false);
                              onNavigate('documents');
                            }}
                            className="text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-md shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <ArrowDownLeft size={12} />
                            إنشاء إذن توريد عاجل
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Render Expiry Alerts */}
                    {(activeTab === 'ALL' || activeTab === 'EXPIRY') && filteredExpiry.map(alert => (
                      <div 
                        key={alert.id}
                        className={`p-3 rounded-xl border transition-all text-xs space-y-1.5 ${
                          alert.type === 'EXPIRED'
                            ? 'bg-red-50/90 dark:bg-red-950/40 border-red-300 dark:border-red-900'
                            : alert.type === 'EXPIRING_CRITICAL'
                            ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-900'
                            : 'bg-yellow-50/70 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900/50'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              alert.type === 'EXPIRED' ? 'bg-red-700 text-white' : 'bg-amber-600 text-white'
                            }`}>
                              {alert.type === 'EXPIRED' ? 'منتهي الصلاحية' : 'قريب الانتهاء'}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-slate-100">{alert.itemName}</span>
                          </div>

                          <button 
                            onClick={(e) => handleDismiss(alert.id, e)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                            title="تجاهل هذا الإشعار"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                          <div>التشغيلة: <strong className="text-slate-800 dark:text-slate-200 font-bold">{alert.batchNo}</strong></div>
                          <div>تاريخ الانتهاء: <strong className="text-slate-800 dark:text-slate-200 font-bold">{alert.expiryDate}</strong></div>
                        </div>

                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-500">المستودع: <strong className="text-slate-800 dark:text-slate-200">{alert.warehouseName}</strong></span>
                          <span className={`font-bold font-mono px-2 py-0.5 rounded ${
                            alert.daysRemaining < 0 
                              ? 'bg-red-200 text-red-900 dark:bg-red-900/80 dark:text-red-100' 
                              : 'bg-amber-200 text-amber-900 dark:bg-amber-900/80 dark:text-amber-100'
                          }`}>
                            {alert.daysRemaining < 0 ? `منتهي منذ ${Math.abs(alert.daysRemaining)} يوم` : `متبقي ${alert.daysRemaining} يوم`}
                          </span>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-800">
                          {alert.daysRemaining < 0 ? (
                            <button
                              onClick={() => {
                                setIsOpen(false);
                                onNavigate('counts');
                              }}
                              className="text-[10px] font-bold bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-md shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <CalendarX size={12} />
                              استبعاد وإسقاط الجرد
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setIsOpen(false);
                                onNavigate('documents');
                              }}
                              className="text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded-md shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <RefreshCw size={12} />
                              تسجيل تحويل / صرف سريع
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                {totalActiveCount > 0 && (
                  <button 
                    onClick={handleDismissAll}
                    className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-[11px] font-bold cursor-pointer"
                  >
                    مسح كافة الإشعارات
                  </button>
                )}

                <button 
                  onClick={() => {
                    setIsOpen(false);
                    onNavigate('reports');
                  }}
                  className="text-blue-600 dark:text-blue-400 font-bold hover:underline mr-auto flex items-center gap-1 cursor-pointer"
                >
                  <span>عرض كشف التقارير التفصيلي</span>
                  <ChevronLeft size={14} />
                </button>
              </div>

            </div>
          </>
        )}
      </div>
    </>
  );
};
