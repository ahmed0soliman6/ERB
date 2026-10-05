import React, { useState, useEffect } from 'react';
import { loadDB, DBSchema, User, saveDB } from './data/db';
import { DashboardView } from './components/DashboardView';
import { InventoryDocsView } from './components/InventoryDocsView';
import { ItemsView } from './components/ItemsView';
import { InventoryCountingView } from './components/InventoryCountingView';
import { ReportsView } from './components/ReportsView';
import { UsersView } from './components/UsersView';
import { BackupLicenseView } from './components/BackupLicenseView';
import { NotificationCenter } from './components/NotificationCenter';
import { SettingsView } from './components/SettingsView';
import { 
  HeartPulse, 
  LayoutDashboard, 
  FileText, 
  Package, 
  ClipboardCheck, 
  BarChart2, 
  Users, 
  Lock, 
  LogOut, 
  Database,
  ChevronLeft,
  Menu,
  X,
  Clock,
  Sun,
  Moon,
  Settings
} from 'lucide-react';

export default function App() {
  const [db, setDb] = useState<DBSchema | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Theme state: 'light' | 'dark'
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('solimedical_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Apply theme to html element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('solimedical_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Stock Balance cache helper (key: `${itemId}-${warehouseId}`)
  const [stockBalances, setStockBalances] = useState<Record<string, number>>({});

  // Login Form States
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Initial load
  useEffect(() => {
    const loadedDb = loadDB();
    setDb(loadedDb);

    // Sync license local state seen time to prevent date rolling back
    if (loadedDb) {
      const updated = { ...loadedDb };
      const currentUtc = new Date().toISOString();
      const currentLocal = new Date().toLocaleDateString('en-US');
      
      // Only advance the seen clock if current time is ahead of database
      if (new Date(currentUtc).getTime() > new Date(updated.license_state.last_seen_utc).getTime()) {
        updated.license_state.last_seen_utc = currentUtc;
        updated.license_state.last_seen_local_date = currentLocal;
        saveDB(updated);
      }
    }

    // Auto login first admin during local development preview
    const savedUser = sessionStorage.getItem('solimedical_erb_user');
    if (savedUser && loadedDb) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  // Compute stock levels from movements ledger whenever DB changes
  useEffect(() => {
    if (!db) return;
    
    // Balance calculation based on append-only movements ledger
    const balances: Record<string, number> = {};
    
    db.movements.forEach((m) => {
      const key = `${m.item_id}-${m.warehouse_id}`;
      if (balances[key] === undefined) {
        balances[key] = 0;
      }
      balances[key] += m.signed_quantity;
    });

    setStockBalances(balances);
  }, [db]);

  const handleRefresh = () => {
    setDb(loadDB());
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!db) return;

    // Direct password match strings for simplicity in dashboard demo
    const foundUser = db.users.find(u => u.username.trim().toLowerCase() === loginUsername.trim().toLowerCase());
    
    if (foundUser) {
      if (!foundUser.is_active) {
        setLoginError('خطأ: حساب المستخدم هذا معطل حالياً من قِبل المسؤول.');
        return;
      }
      // Demo authentication: allow password "123" or matching credentials
      if (loginPassword === '123' || loginPassword === 'admin123' || loginPassword === 'manager123' || loginPassword === 'user123' || loginPassword === 'viewer123') {
        setCurrentUser(foundUser);
        sessionStorage.setItem('solimedical_erb_user', JSON.stringify(foundUser));
        setLoginUsername('');
        setLoginPassword('');
      } else {
        setLoginError('خطأ: اسم المستخدم أو كلمة المرور غير صحيحة!');
      }
    } else {
      setLoginError('خطأ: اسم المستخدم غير مسجل بنظام المستودعات.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('solimedical_erb_user');
  };

  if (!db) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-950">
        <div className="text-center space-y-3">
          <HeartPulse className="animate-pulse text-blue-600 dark:text-blue-400 mx-auto" size={52} />
          <h2 className="text-slate-700 dark:text-slate-200 font-bold text-lg">جاري تحميل نظام SoliMedical-ERB...</h2>
        </div>
      </div>
    );
  }

  // Render Login view if no authenticated user
  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 select-none relative transition-colors duration-200">
        {/* Floating Theme Switcher on Login Screen */}
        <div className="absolute top-5 left-5 z-20">
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-2 text-xs font-bold"
            title={theme === 'dark' ? 'التحويل للوضع النهاري' : 'التحويل للوضع الليلي'}
          >
            {theme === 'dark' ? (
              <>
                <Sun size={18} className="text-amber-400" />
                <span>نهاري</span>
              </>
            ) : (
              <>
                <Moon size={18} className="text-indigo-600" />
                <span>ليلي</span>
              </>
            )}
          </button>
        </div>

        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl p-6 md:p-8 space-y-6">
          
          {/* Medical Logo and Welcome header */}
          <div className="text-center space-y-2">
            <div className="bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 p-4 rounded-full inline-flex border-2 border-blue-100 dark:border-blue-900/60 shadow-sm">
              <HeartPulse size={36} className="stroke-[2.5]" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">SoliMedical-ERB</h1>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider">نظام إدارة مستودعات المجمع الطبي</span>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-400 rounded-xl text-xs font-bold leading-relaxed text-right">
                ⚠️ {loginError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">اسم المستخدم (Username)</label>
              <input 
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="أدخل اسم الحساب (مثل: admin أو manager)"
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/60 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">كلمة المرور (Password)</label>
              <input 
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="أدخل كلمة المرور (افتراضية: 123)"
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/60 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-sm shadow-md hover:shadow-lg transition-all"
            >
              تسجيل الدخول الآمن
            </button>
          </form>

          {/* Demo helper */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-150 dark:border-slate-800 p-3.5 rounded-2xl text-[11px] text-slate-500 dark:text-slate-400 leading-normal text-right space-y-1.5">
            <span className="font-bold text-slate-700 dark:text-slate-300 block">💡 حسابات تجريبية سريعة بالنظام (كلمة المرور: 123):</span>
            <ul className="list-disc list-inside space-y-1">
              <li>المسؤول العام: <strong className="font-mono text-slate-800 dark:text-slate-200">admin</strong></li>
              <li>مدير المستودعات: <strong className="font-mono text-slate-800 dark:text-slate-200">manager</strong></li>
              <li>أمين مخزن الرئيسي: <strong className="font-mono text-slate-800 dark:text-slate-200">user_main</strong></li>
              <li>مراقب الحسابات: <strong className="font-mono text-slate-800 dark:text-slate-200">viewer</strong></li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Sidebar navigation options
  const sidebarItems = [
    { id: 'dashboard', name: 'لوحة التحكم والإحصاء', icon: <LayoutDashboard size={18} /> },
    { id: 'items', name: 'دليل الأصناف والكتالوج', icon: <Package size={18} /> },
    { id: 'documents', name: 'إدارة المستندات المخزنية', icon: <FileText size={18} /> },
    { id: 'counts', name: 'الجرد والتسويات', icon: <ClipboardCheck size={18} /> },
    { id: 'reports', name: 'التقارير والتحليلات', icon: <BarChart2 size={18} /> },
    { id: 'users', name: 'المستخدمين والصلاحيات', icon: <Users size={18} /> },
    { id: 'backups', name: 'الأمن، النسخ والترخيص', icon: <Database size={18} /> },
    { id: 'settings', name: 'إعدادات الحساب', icon: <Settings size={18} /> },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-200">
      
      {/* Sidebar for Desktop / Mobile */}
      <aside className={`fixed inset-y-0 right-0 z-40 w-64 bg-white dark:bg-slate-900 border-l border-slate-200/80 dark:border-slate-800 flex flex-col justify-between shadow-sm transition-transform duration-200 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Brand & Navigation */}
        <div className="flex flex-col">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="bg-blue-600 dark:bg-blue-600 text-white p-2 rounded-xl shadow-sm">
                <HeartPulse size={20} />
              </div>
              <div>
                <h1 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight leading-none">SoliMedical-ERB</h1>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1 block">إدارة مخازن المجمع الطبي</span>
              </div>
            </div>
            
            {/* Close Mobile Sidebar */}
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <X size={18} />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="p-4 space-y-1.5 flex-1">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { setCurrentView(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                  currentView === item.id 
                    ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 shadow-sm border-r-4 border-blue-600 dark:border-blue-500' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.icon}
                <span>{item.name}</span>
                <ChevronLeft size={14} className={`mr-auto transition-transform ${currentView === item.id ? 'translate-x-0' : 'translate-x-1 opacity-0 group-hover:opacity-100'}`} />
              </button>
            ))}
          </nav>
        </div>

        {/* User Info & Logout Button */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3 bg-slate-50/70 dark:bg-slate-900/90">
          <div className="flex items-center gap-2.5 text-xs">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold">
              {currentUser.display_name.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">{currentUser.display_name}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-mono">@{currentUser.username} ({currentUser.role})</span>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <LogOut size={14} />
            تسجيل الخروج الآمن
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Desktop/Mobile header */}
        <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 h-16 flex items-center justify-between px-6 sticky top-0 z-30 shadow-sm shrink-0 transition-colors">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
              <Menu size={22} />
            </button>
            <div className="hidden lg:flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>المجمع الطبي</span>
              <span>/</span>
              <span className="text-slate-800 dark:text-slate-100 font-black">
                {sidebarItems.find(item => item.id === currentView)?.name || 'اللوحة الرئيسية'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Smart Notification Bell & Drawer */}
            <NotificationCenter 
              db={db} 
              user={currentUser} 
              stockBalances={stockBalances} 
              onNavigate={(view) => setCurrentView(view)} 
            />

            {/* Dark / Light Mode Switcher Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/80 transition-all flex items-center gap-1.5 text-xs font-bold"
              title={theme === 'dark' ? 'تفعيل الوضع النهاري (Light Mode)' : 'تفعيل الوضع الليلي (Dark Mode)'}
            >
              {theme === 'dark' ? (
                <>
                  <Sun size={16} className="text-amber-400" />
                  <span className="hidden sm:inline">نهاري</span>
                </>
              ) : (
                <>
                  <Moon size={16} className="text-indigo-600" />
                  <span className="hidden sm:inline">ليلي</span>
                </>
              )}
            </button>

            <div className="hidden md:flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full text-[10px] text-slate-500 dark:text-slate-400 font-bold border border-slate-200/60 dark:border-slate-700/80">
              <Clock size={12} className="text-slate-400 dark:text-slate-500" />
              <span>آخر دخول: {currentUser.last_login_at ? new Date(currentUser.last_login_at).toLocaleString('ar-EG') : 'الآن'}</span>
            </div>

            <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-full text-[10px] font-bold border border-emerald-200/60 dark:border-emerald-900/60">
              <Lock size={12} />
              <span>مؤمن محلياً</span>
            </div>
          </div>
        </header>

        {/* Dynamic content view rendering */}
        <main className="flex-grow p-6">
          {currentView === 'dashboard' && (
            <DashboardView 
              db={db} 
              user={currentUser} 
              onNavigate={(view) => setCurrentView(view)} 
              stockBalances={stockBalances} 
            />
          )}
          {currentView === 'documents' && (
            <InventoryDocsView 
              db={db} 
              user={currentUser} 
              onRefresh={handleRefresh} 
              stockBalances={stockBalances} 
            />
          )}
          {currentView === 'items' && (
            <ItemsView 
              db={db} 
              user={currentUser} 
              onRefresh={handleRefresh} 
              stockBalances={stockBalances} 
            />
          )}
          {currentView === 'counts' && (
            <InventoryCountingView 
              db={db} 
              user={currentUser} 
              onRefresh={handleRefresh} 
              stockBalances={stockBalances} 
            />
          )}
          {currentView === 'reports' && (
            <ReportsView 
              db={db} 
              user={currentUser} 
              stockBalances={stockBalances} 
            />
          )}
          {currentView === 'users' && (
            <UsersView 
              db={db} 
              user={currentUser} 
              onRefresh={handleRefresh} 
            />
          )}
          {currentView === 'backups' && (
            <BackupLicenseView 
              db={db} 
              user={currentUser} 
              onRefresh={handleRefresh} 
            />
          )}
          {currentView === 'settings' && (
            <SettingsView 
              db={db} 
              user={currentUser} 
              onRefresh={handleRefresh}
              onUserUpdate={(updatedUser) => setCurrentUser(updatedUser)}
            />
          )}
        </main>

        {/* Footer info showing SQLite WAL and local state */}
        <footer className="bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 py-3.5 px-6 flex flex-col md:flex-row justify-between text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wide shrink-0 transition-colors">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>قاعدة البيانات: SQLite WAL (Simulated)</span>
            <span>|</span>
            <span>رقم الإصدار: v1.0.0 Stable</span>
          </div>
          <div>
            <span>جميع الحقوق محفوظة للمجمع الطبي © 2026</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
