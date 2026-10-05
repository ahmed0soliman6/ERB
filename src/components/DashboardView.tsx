import React, { useState, useMemo, useEffect } from 'react';
import { 
  Package, AlertTriangle, ArrowUpRight, ArrowDownLeft, RefreshCw, 
  BarChart2, CheckCircle, Database, ChevronLeft, CalendarX,
  Clock, Download, Layers, Search, CheckCircle2,
  Calendar, TrendingUp, Activity, PieChart as PieIcon, KeyRound, Key
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { DBSchema } from '../data/db';
import { computeSmartNotifications } from '../utils/alertEngine';

interface DashboardProps {
  db: DBSchema;
  user: any;
  onNavigate: (view: string) => void;
  stockBalances: Record<string, number>;
}

export const DashboardView: React.FC<DashboardProps> = ({ db, user, onNavigate, stockBalances }) => {
  const [chartViewMode, setChartViewMode] = useState<'WAREHOUSES' | 'TIMELINE' | 'CATEGORIES'>('WAREHOUSES');
  
  // Real-time live date and clock (read directly from host OS / local machine)
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentTime.toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const formattedTime = currentTime.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  // Filters for Reorder Point Report
  const [reorderDeptFilter, setReorderDeptFilter] = useState<number | 'ALL'>('ALL');
  const [reorderSeverityFilter, setReorderSeverityFilter] = useState<'ALL' | 'OUT_OF_STOCK' | 'CRITICAL' | 'WARNING'>('ALL');
  const [reorderSearch, setReorderSearch] = useState('');

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

  // =========================================================================
  // 📊 RECHARTS ANALYTICS DATA GENERATION
  // =========================================================================
  
  // 1. Warehouse Flows (Inflow vs Outflow)
  const warehouseFlowData = useMemo(() => {
    return db.warehouses.map(wh => {
      const whMovements = db.movements.filter(m => m.warehouse_id === wh.id);
      const totalIn = whMovements
        .filter(m => m.direction === 'IN')
        .reduce((sum, m) => sum + m.quantity, 0);
      const totalOut = Math.abs(
        whMovements
          .filter(m => m.direction === 'OUT')
          .reduce((sum, m) => sum + m.quantity, 0)
      );
      
      let shortName = wh.name;
      if (wh.code === 'MAIN') shortName = 'الرئيسي';
      else if (wh.code === 'OR_SU') shortName = 'مستهلكات العمليات';
      else if (wh.code === 'OR_DR') shortName = 'أدوية العمليات';
      else if (wh.code === 'EMER') shortName = 'الطوارئ';

      return {
        name: shortName,
        fullName: wh.name,
        الوارد: totalIn,
        المنصرف: totalOut,
        الصافي: totalIn - totalOut
      };
    });
  }, [db]);

  // 2. Timeline Movement Trends (Recent chronological aggregation)
  const timelineFlowData = useMemo(() => {
    const dateMap: Record<string, { date: string; displayDate: string; الوارد: number; المنصرف: number }> = {};
    
    db.movements.forEach(m => {
      const rawDate = m.occurred_at ? m.occurred_at.split('T')[0] : '2026-10-01';
      if (!dateMap[rawDate]) {
        const parts = rawDate.split('-');
        const display = parts.length === 3 ? `${parts[2]}/${parts[1]}` : rawDate;
        dateMap[rawDate] = { date: rawDate, displayDate: display, الوارد: 0, المنصرف: 0 };
      }
      if (m.direction === 'IN') {
        dateMap[rawDate].الوارد += m.quantity;
      } else {
        dateMap[rawDate].المنصرف += Math.abs(m.quantity);
      }
    });

    const list = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
    return list.slice(-8); // Last 8 active dates
  }, [db]);

  // 3. Category Distribution
  const categoryDistributionData = useMemo(() => {
    const palette = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#6366f1', '#14b8a6'];
    return db.categories.map((cat, idx) => {
      const count = db.items.filter(it => it.category_id === cat.id).length;
      return {
        name: cat.name,
        value: count,
        color: palette[idx % palette.length]
      };
    }).filter(c => c.value > 0);
  }, [db]);

  // Total Movement Statistics
  const totalInflowAll = useMemo(() => {
    return db.movements.filter(m => m.direction === 'IN').reduce((s, m) => s + m.quantity, 0);
  }, [db]);

  const totalOutflowAll = useMemo(() => {
    return Math.abs(db.movements.filter(m => m.direction === 'OUT').reduce((s, m) => s + m.quantity, 0));
  }, [db]);

  // Filtered Reorder Alerts for the Detailed Report Table
  const filteredReorderAlerts = useMemo(() => {
    return reorderAlerts.filter(al => {
      // Dept filter
      if (reorderDeptFilter !== 'ALL' && al.warehouseId !== reorderDeptFilter) {
        return false;
      }
      // Severity filter
      if (reorderSeverityFilter === 'OUT_OF_STOCK' && al.currentStock > 0) {
        return false;
      }
      if (reorderSeverityFilter === 'CRITICAL' && (al.severity !== 'CRITICAL' || al.currentStock === 0)) {
        return false;
      }
      if (reorderSeverityFilter === 'WARNING' && al.severity !== 'WARNING') {
        return false;
      }
      // Search
      if (reorderSearch.trim()) {
        const q = reorderSearch.toLowerCase().trim();
        const matchName = al.itemName.toLowerCase().includes(q);
        const matchSku = al.sku.toLowerCase().includes(q);
        const matchWh = al.warehouseName.toLowerCase().includes(q);
        if (!matchName && !matchSku && !matchWh) return false;
      }
      return true;
    });
  }, [reorderAlerts, reorderDeptFilter, reorderSeverityFilter, reorderSearch]);

  // Statistics for Reorder Report
  const outOfStockCount = useMemo(() => reorderAlerts.filter(a => a.currentStock === 0).length, [reorderAlerts]);
  const totalDeficitQty = useMemo(() => reorderAlerts.reduce((sum, a) => sum + a.deficit, 0), [reorderAlerts]);
  
  // Health score percentage (safe items / total monitored)
  const totalMonitored = activeItemsCount * activeWarehousesCount;
  const healthScore = totalMonitored > 0 ? Math.max(0, Math.round(((totalMonitored - reorderAlerts.length) / totalMonitored) * 100)) : 100;

  // Export Reorder Report to CSV
  const handleExportReorderCSV = () => {
    const headers = [
      'اسم الصنف الطبي',
      'الرمز SKU',
      'التصنيف',
      'المستودع / القسم',
      'الرصيد الفعلي الحالي',
      'حد الامان (الطلب)',
      'العجز المطلوب للتغطية',
      'الوحدة',
      'حالة النقص والخطورة'
    ];

    const rows = filteredReorderAlerts.map(a => [
      `"${a.itemName.replace(/"/g, '""')}"`,
      `"${a.sku}"`,
      `"${a.categoryName}"`,
      `"${a.warehouseName}"`,
      a.currentStock,
      a.minimumStock,
      a.deficit,
      `"${a.unitName}"`,
      a.currentStock === 0 ? 'نفاد تام 🔴' : a.severity === 'CRITICAL' ? 'حرج جداً 🟠' : 'تحت حد الطلب 🟡'
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `تقرير_نواقص_وحد_الطلب_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 font-sans max-w-full overflow-x-hidden">
      
      {/* 1️⃣ Welcome Header: Name and Live Date/Time in the SAME horizontal row with large bold font and spacing */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-800 rounded-2xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 transform translate-x-12 -translate-y-12 opacity-10 pointer-events-none">
          <Database size={240} />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Greeting */}
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
            مرحباً بك، {user.display_name} 👋
          </h1>
          
          {/* Live Date and Time in the same row with large, clear font */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/25 backdrop-blur-md rounded-xl px-4 py-2 text-sm sm:text-base font-bold text-white shadow-xs border border-white/25 transition-all">
              <Calendar size={18} className="text-blue-200" />
              <span>{formattedDate}</span>
            </div>
            
            <div className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/25 backdrop-blur-md rounded-xl px-4 py-2 text-base sm:text-lg font-mono font-black text-amber-300 shadow-xs border border-white/25 transition-all">
              <Clock size={18} className="text-amber-300 animate-pulse" />
              <span dir="ltr">{formattedTime}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Proactive 30-Day License Expiry Warning Banner (If applicable) */}
      {smartNotifications.licenseAlert && (
        <div className={`p-4 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm transition-all animate-fadeIn ${
          smartNotifications.licenseAlert.severity === 'CRITICAL'
            ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60 text-red-900 dark:text-red-100'
            : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-100'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl text-white shrink-0 ${
              smartNotifications.licenseAlert.severity === 'CRITICAL' ? 'bg-red-600 shadow-sm' : 'bg-amber-500 shadow-sm'
            }`}>
              <KeyRound size={22} />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm">
                  {smartNotifications.licenseAlert.type === 'LICENSE_EXPIRED' ? 'تنبيه عاجل: انتهاء ترخيص النظام' : 'تنبيه استباقي: اقتراب انتهاء ترخيص البرنامج'}
                </h3>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold text-white ${
                  smartNotifications.licenseAlert.daysRemaining < 0 ? 'bg-red-600' : 'bg-amber-600'
                }`}>
                  {smartNotifications.licenseAlert.daysRemaining < 0 ? 'منتهي' : `متبقي ${smartNotifications.licenseAlert.daysRemaining} يوم`}
                </span>
              </div>
              <p className="text-xs opacity-90 leading-relaxed font-medium">
                {smartNotifications.licenseAlert.message}
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('backups')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm flex items-center gap-2 transition-all shrink-0 cursor-pointer"
          >
            <Key size={14} />
            <span>تجديد وتفعيل الترخيص</span>
          </button>
        </div>
      )}

      {/* 2️⃣ Grid of Key Interactive Metrics Cards */}
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
            const el = document.getElementById('reorder-report-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
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
            <span>تقرير النواقص الفوري</span>
            <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          </div>
        </button>

        {/* Card 4: Expiry Alerts */}
        <button
          onClick={() => onNavigate('reports')}
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

      {/* 3️⃣ COMPREHENSIVE REORDER POINT & SUPPLY CONTINUITY REPORT SECTION */}
      <div id="reorder-report-section" className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 sm:p-6 space-y-5">
        
        {/* Report Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-sm shrink-0">
              <AlertTriangle size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-800 dark:text-slate-100 text-base sm:text-lg">
                  تقرير موجز: تنبيهات حد الطلب واستمرارية التوريد (Reorder Point Alert Report)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">
                  محدث حياً
                </span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed">
                متابعة استباقية للأصناف التي وصلت أو انخفضت عن حد الأمان الأدنى (Minimum Stock) لاحتساب كميات العجز وضمان استمرارية الإمداد الطبي.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportReorderCSV}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="تصدير تقرير النواقص بصيغة Excel CSV"
            >
              <Download size={14} />
              <span>تصدير Excel</span>
            </button>

            <button
              onClick={() => onNavigate('documents')}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <ArrowDownLeft size={14} />
              <span>إنشاء سند توريد للنواقص</span>
            </button>
          </div>
        </div>

        {/* Executive Summary Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-800 text-center space-y-1">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">إجمالي أصناف النواقص</span>
            <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">{reorderAlerts.length} صنف</div>
            <span className="text-[10px] text-slate-400 block">تحت حد الأمان</span>
          </div>

          <div className="p-3.5 bg-red-50/60 dark:bg-red-950/30 rounded-xl border border-red-200/60 dark:border-red-900/40 text-center space-y-1">
            <span className="text-[11px] text-red-600 dark:text-red-400 font-bold block">أصناف نفدت بالكامل (0)</span>
            <div className="text-xl font-black text-red-600 dark:text-red-400 font-mono">{outOfStockCount} صنف</div>
            <span className="text-[10px] text-red-500/80 block">تتطلب توريد فوري عاجل</span>
          </div>

          <div className="p-3.5 bg-purple-50/60 dark:bg-purple-950/30 rounded-xl border border-purple-200/60 dark:border-purple-900/40 text-center space-y-1">
            <span className="text-[11px] text-purple-600 dark:text-purple-400 font-bold block">إجمالي العجز المطلوب</span>
            <div className="text-xl font-black text-purple-600 dark:text-purple-400 font-mono">+{totalDeficitQty} وحدة</div>
            <span className="text-[10px] text-purple-500/80 block">لتغطية حد الأمان</span>
          </div>

          <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 text-center space-y-1">
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold block">مؤشر الجاهزية والاستمرارية</span>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{healthScore}%</div>
            <span className="text-[10px] text-emerald-500/80 block">نسبة الأرصدة الآمنة</span>
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800">
          
          {/* Department Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1 flex items-center gap-1">
              <Layers size={13} />
              المخزن:
            </span>
            <button
              onClick={() => setReorderDeptFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                reorderDeptFilter === 'ALL'
                  ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
              }`}
            >
              كافة المخازن ({reorderAlerts.length})
            </button>
            {db.warehouses.map(wh => {
              const count = reorderAlerts.filter(a => a.warehouseId === wh.id).length;
              return (
                <button
                  key={wh.id}
                  onClick={() => setReorderDeptFilter(wh.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    reorderDeptFilter === wh.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {wh.name} ({count})
                </button>
              );
            })}
          </div>

          {/* Severity + Search */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={reorderSeverityFilter}
              onChange={(e) => setReorderSeverityFilter(e.target.value as any)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            >
              <option value="ALL">جميع الحالات</option>
              <option value="OUT_OF_STOCK">نفاد تام (0 رصيد) 🔴</option>
              <option value="CRITICAL">حرج جداً (&lt; 50%) 🟠</option>
              <option value="WARNING">تحت حد الأمان 🟡</option>
            </select>

            <div className="relative flex-1 sm:w-48">
              <Search size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={reorderSearch}
                onChange={(e) => setReorderSearch(e.target.value)}
                placeholder="بحث باسم الصنف..."
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg pr-7 pl-2.5 py-1 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Detailed Reorder Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
          <table className="min-w-[850px] w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black border-b border-slate-200 dark:border-slate-700">
                <th className="p-3 w-10 text-center">م</th>
                <th className="p-3 min-w-[200px]">اسم الصنف الطبي والرمز</th>
                <th className="p-3 w-32">المستودع / القسم</th>
                <th className="p-3 w-28 text-center">الرصيد الفعلي</th>
                <th className="p-3 w-28 text-center">حد الأمان (الطلب)</th>
                <th className="p-3 w-28 text-center">العجز المطلوب</th>
                <th className="p-3 w-36 text-center">مستوى التغطية</th>
                <th className="p-3 w-28 text-center">حالة النقص</th>
                <th className="p-3 w-32 text-center">إجراء سريع</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200 font-semibold">
              {filteredReorderAlerts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-emerald-600 dark:text-emerald-400 font-bold">
                    <CheckCircle2 size={32} className="mx-auto mb-2 opacity-80" />
                    ممتاز! لا توجد أصناف تحت حد الطلب ضمن الفلاتر المحددة.
                  </td>
                </tr>
              ) : (
                filteredReorderAlerts.map((item, idx) => {
                  const coveragePercent = item.minimumStock > 0 ? Math.min(100, Math.round((item.currentStock / item.minimumStock) * 100)) : 0;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      {/* م */}
                      <td className="p-3 text-center font-mono text-slate-400 text-xs">
                        {idx + 1}
                      </td>

                      {/* الصنف */}
                      <td className="p-3">
                        <span className="font-bold text-slate-900 dark:text-slate-100 block">{item.itemName}</span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                          <span>SKU: {item.sku}</span>
                          <span>•</span>
                          <span>{item.categoryName}</span>
                        </div>
                      </td>

                      {/* المستودع */}
                      <td className="p-3 text-slate-600 dark:text-slate-300">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          {item.warehouseName}
                        </span>
                      </td>

                      {/* الرصيد الفعلي */}
                      <td className="p-3 text-center font-mono font-black">
                        <span className={`text-sm ${item.currentStock === 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {item.currentStock} {item.unitName}
                        </span>
                      </td>

                      {/* حد الأمان */}
                      <td className="p-3 text-center font-mono text-slate-500 dark:text-slate-400 font-bold">
                        {item.minimumStock} {item.unitName}
                      </td>

                      {/* العجز المطلوب */}
                      <td className="p-3 text-center font-mono font-black text-rose-600 dark:text-rose-400 bg-rose-50/30 dark:bg-rose-950/20">
                        +{item.deficit} {item.unitName}
                      </td>

                      {/* شريط مستوى التغطية */}
                      <td className="p-3 text-center">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-mono text-slate-400">
                            <span>{coveragePercent}%</span>
                            <span>{item.currentStock}/{item.minimumStock}</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${
                                item.currentStock === 0 ? 'bg-red-600' : coveragePercent < 50 ? 'bg-amber-500' : 'bg-yellow-500'
                              }`}
                              style={{ width: `${coveragePercent}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>

                      {/* حالة النقص */}
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black inline-block ${
                          item.currentStock === 0
                            ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/60'
                            : item.severity === 'CRITICAL'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60'
                            : 'bg-yellow-100 dark:bg-yellow-950/60 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-900/60'
                        }`}>
                          {item.currentStock === 0 ? 'نفاد تام 🔴' : item.severity === 'CRITICAL' ? 'حرج جداً 🟠' : 'تحت حد الطلب 🟡'}
                        </span>
                      </td>

                      {/* إجراء سريع */}
                      <td className="p-3 text-center">
                        <button
                          onClick={() => onNavigate('documents')}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 mx-auto cursor-pointer"
                        >
                          <ArrowDownLeft size={12} />
                          <span>طلب توريد</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Reorder Table Footer */}
        <div className="flex flex-wrap justify-between items-center text-xs text-slate-500 dark:text-slate-400 pt-1">
          <span>عرض <strong>{filteredReorderAlerts.length}</strong> صنف ناقص من إجمالي <strong>{reorderAlerts.length}</strong> تنبيه مسجل</span>
          <span className="font-bold text-slate-700 dark:text-slate-300">
            إجمالي كميات العجز المطلوبة للتعويض: <strong className="text-rose-600 dark:text-rose-400 font-mono font-black">{filteredReorderAlerts.reduce((s, a) => s + a.deficit, 0)}</strong> وحدة
          </span>
        </div>
      </div>

      {/* 4️⃣ RECHARTS INTERACTIVE MOVEMENT ANALYTICS SECTION (Placed at the bottom) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 sm:p-6 space-y-5">
        
        {/* Analytics Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
              <Activity size={22} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 dark:text-slate-100 text-base sm:text-lg flex items-center gap-2">
                التحليل البياني للتدفقات المخزنية (وارد وصادر)
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                مخطط إحصائي تفاعلي يوضح كميات التوريد والمنصرف وتوزيع المخزون بالمجمع الطبي
              </p>
            </div>
          </div>

          {/* Chart View Switcher */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
            <button
              onClick={() => setChartViewMode('WAREHOUSES')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                chartViewMode === 'WAREHOUSES'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BarChart2 size={14} />
              <span>حسب المستودع</span>
            </button>
            <button
              onClick={() => setChartViewMode('TIMELINE')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                chartViewMode === 'TIMELINE'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TrendingUp size={14} />
              <span>التدفق الزمني</span>
            </button>
            <button
              onClick={() => setChartViewMode('CATEGORIES')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                chartViewMode === 'CATEGORIES'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <PieIcon size={14} />
              <span>التصنيفات الطبية</span>
            </button>
          </div>
        </div>

        {/* Quick KPI badges for movement summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 text-center">
            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold block">إجمالي الوارد (Inflow)</span>
            <div className="text-lg font-black text-emerald-700 dark:text-emerald-300 font-mono mt-0.5">+{totalInflowAll}</div>
          </div>
          <div className="p-3 bg-rose-50/70 dark:bg-rose-950/30 rounded-xl border border-rose-200/60 dark:border-rose-900/40 text-center">
            <span className="text-[11px] text-rose-700 dark:text-rose-400 font-bold block">إجمالي المنصرف (Outflow)</span>
            <div className="text-lg font-black text-rose-700 dark:text-rose-300 font-mono mt-0.5">-{totalOutflowAll}</div>
          </div>
          <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-200/60 dark:border-blue-900/40 text-center">
            <span className="text-[11px] text-blue-700 dark:text-blue-400 font-bold block">صافي التدفق المخزني</span>
            <div className="text-lg font-black text-blue-700 dark:text-blue-300 font-mono mt-0.5">{totalInflowAll - totalOutflowAll}</div>
          </div>
          <div className="p-3 bg-purple-50/70 dark:bg-purple-950/30 rounded-xl border border-purple-200/60 dark:border-purple-900/40 text-center">
            <span className="text-[11px] text-purple-700 dark:text-purple-400 font-bold block">إجمالي الحركات المسجلة</span>
            <div className="text-lg font-black text-purple-700 dark:text-purple-300 font-mono mt-0.5">{db.movements.length} حركة</div>
          </div>
        </div>

        {/* Dynamic Chart Container */}
        <div className="h-72 sm:h-80 w-full pt-2">
          {chartViewMode === 'WAREHOUSES' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={warehouseFlowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 'bold' }} 
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis 
                  tick={{ fill: '#94a3b8', fontSize: 11 }} 
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                    borderRadius: '12px', 
                    border: '1px solid #334155', 
                    color: '#fff', 
                    fontSize: '12px',
                    direction: 'rtl',
                    textAlign: 'right'
                  }} 
                  formatter={(value: any, name: any) => [`${value} وحدة`, name]}
                  labelFormatter={(label) => `مستودع: ${label}`}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '10px', fontSize: '12px', fontWeight: 'bold' }} 
                />
                <Bar dataKey="الوارد" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={45} />
                <Bar dataKey="المنصرف" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={45} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {chartViewMode === 'TIMELINE' && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineFlowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis 
                  dataKey="displayDate" 
                  tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 'bold' }} 
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis 
                  tick={{ fill: '#94a3b8', fontSize: 11 }} 
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                    borderRadius: '12px', 
                    border: '1px solid #334155', 
                    color: '#fff', 
                    fontSize: '12px',
                    direction: 'rtl',
                    textAlign: 'right'
                  }} 
                  formatter={(value: any, name: any) => [`${value} وحدة`, name]}
                />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px', fontWeight: 'bold' }} />
                <Area type="monotone" dataKey="الوارد" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#inflowGrad)" />
                <Area type="monotone" dataKey="المنصرف" stroke="#f43f5e" strokeWidth={2.5} fillOpacity={1} fill="url(#outflowGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}

          {chartViewMode === 'CATEGORIES' && (
            <div className="flex flex-col md:flex-row items-center justify-center h-full gap-4">
              <div className="w-full md:w-1/2 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {categoryDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                        borderRadius: '12px', 
                        border: '1px solid #334155', 
                        color: '#fff', 
                        fontSize: '12px',
                        direction: 'rtl',
                        textAlign: 'right'
                      }} 
                      formatter={(value: any, name: any) => [`${value} صنف`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Category Legend list */}
              <div className="w-full md:w-1/2 grid grid-cols-2 gap-2 text-xs">
                {categoryDistributionData.map((cat) => (
                  <div key={cat.name} className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-150 dark:border-slate-800">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }}></span>
                    <span className="font-bold text-slate-700 dark:text-slate-300 truncate">{cat.name}</span>
                    <span className="font-mono text-slate-400 mr-auto font-bold">({cat.value})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
