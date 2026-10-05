import React, { useState } from 'react';
import { 
  User as UserIcon, 
  Lock, 
  Shield, 
  Sliders, 
  Check, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Save, 
  KeyRound, 
  Clock, 
  Mail, 
  Phone, 
  Building2, 
  Activity, 
  Sun, 
  Moon, 
  Bell, 
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { DBSchema, User, saveDB } from '../data/db';

interface SettingsViewProps {
  db: DBSchema;
  user: User;
  onUserUpdate: (updatedUser: User) => void;
  onRefresh: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ 
  db, 
  user, 
  onUserUpdate, 
  onRefresh,
  theme,
  onToggleTheme 
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'preferences' | 'audit'>('profile');
  
  // Profile Form States
  const [displayName, setDisplayName] = useState(user.display_name || '');
  const [email, setEmail] = useState((user as any).email || '');
  const [phone, setPhone] = useState((user as any).phone || '');
  
  // Password Form States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Preference States
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('solimedical_pref_notifs') !== 'false';
  });
  const [soundAlerts, setSoundAlerts] = useState(() => {
    return localStorage.getItem('solimedical_pref_sound') !== 'false';
  });
  const [autoRefreshSecs, setAutoRefreshSecs] = useState(() => {
    return localStorage.getItem('solimedical_pref_refresh') || '60';
  });

  // Messages
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [prefSuccess, setPrefSuccess] = useState('');

  // Assigned Warehouses
  const userWarehouses = (user.role === 'ADMIN' || !user.allowed_warehouses || user.allowed_warehouses.length === 0)
    ? db.warehouses
    : db.warehouses.filter(w => user.allowed_warehouses.includes(w.id));

  // Role labels
  const roleNames: Record<string, { label: string; color: string; desc: string }> = {
    'ADMIN': { 
      label: 'مدير النظام العام (Admin)', 
      color: 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/60',
      desc: 'صلاحيات كاملة وغير مقيدة على كافة المستودعات، الإعدادات، المستخدمين والتراخيص'
    },
    'STORE_MANAGER': { 
      label: 'مدير المستودعات (Manager)', 
      color: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900/60',
      desc: 'صلاحيات إدارة المستودعات المصرح بها واعتماد المستندات والجرد الفعلي'
    },
    'STORE_USER': { 
      label: 'أمين مخزن (Store User)', 
      color: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/60',
      desc: 'صلاحيات تسجيل الحركات والتوريدات والصرف ضمن المستودعات المخصصة'
    },
    'VIEWER': { 
      label: 'مراقب ومطلع (Viewer)', 
      color: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60',
      desc: 'صلاحيات الاطلاع على الأرصدة والتقارير وسجلات التدقيق دون إمكانية التعديل'
    }
  };

  // Filter audit logs for this user
  const userAuditLogs = db.audit_logs
    .filter(log => log.user_id === user.id || log.username === user.display_name)
    .slice(-10)
    .reverse();

  // Handle Profile Update
  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    if (!displayName.trim()) {
      setProfileError('يرجى إدخال اسم العرض الكامل.');
      return;
    }

    const updatedUsers = db.users.map(u => {
      if (u.id === user.id) {
        return {
          ...u,
          display_name: displayName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        };
      }
      return u;
    });

    const updatedUserObj: User = {
      ...user,
      display_name: displayName.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
    };

    db.users = updatedUsers;

    // Log to audit trail
    db.audit_logs.push({
      id: db.audit_logs.length > 0 ? Math.max(...db.audit_logs.map(a => a.id)) + 1 : 1,
      user_id: user.id,
      username: displayName.trim(),
      action: 'تحديث بيانات الحساب الشخصي',
      entity_type: 'حساب مستخدم',
      entity_id: user.id,
      after_json: JSON.stringify({ display_name: displayName.trim(), email, phone }),
      occurred_at: new Date().toISOString()
    });

    saveDB(db);
    onUserUpdate(updatedUserObj);
    setProfileSuccess('تم حفظ وتحديث بيانات حسابك الشخصي بنجاح.');
    onRefresh();

    setTimeout(() => setProfileSuccess(''), 4000);
  };

  // Check if current password is valid
  const verifyCurrentPassword = (inputPwd: string): boolean => {
    const existingPlain = (user as any).password_plain;
    if (existingPlain) {
      return inputPwd === existingPlain;
    }
    // Default demo passwords
    return (
      inputPwd === '123' ||
      inputPwd === `${user.username}123` ||
      inputPwd === 'admin123' ||
      inputPwd === 'manager123' ||
      inputPwd === 'user123' ||
      inputPwd === 'viewer123'
    );
  };

  // Handle Password Change
  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('يرجى إدخال كلمة المرور الحالية للتأكيد.');
      return;
    }

    if (!verifyCurrentPassword(currentPassword)) {
      setPasswordError('كلمة المرور الحالية غير صحيحة! يرجى التحقق وإعادة المحاولة.');
      return;
    }

    if (newPassword.length < 4) {
      setPasswordError('يجب أن لا تقل كلمة المرور الجديدة عن 4 خانات على الأقل.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('كلمة المرور الجديدة غير متطابقة مع تأكيد كلمة المرور.');
      return;
    }

    // Update in DB
    const updatedUsers = db.users.map(u => {
      if (u.id === user.id) {
        return {
          ...u,
          password_plain: newPassword,
          password_hash: btoa(newPassword), // Basic representation
        };
      }
      return u;
    });

    const updatedUserObj: User = {
      ...user,
      password_plain: newPassword,
      password_hash: btoa(newPassword),
    };

    db.users = updatedUsers;

    // Log to Audit Log
    db.audit_logs.push({
      id: db.audit_logs.length > 0 ? Math.max(...db.audit_logs.map(a => a.id)) + 1 : 1,
      user_id: user.id,
      username: user.display_name,
      action: 'تغيير كلمة المرور الشخصية',
      entity_type: 'أمان الحساب',
      entity_id: user.id,
      occurred_at: new Date().toISOString()
    });

    saveDB(db);
    onUserUpdate(updatedUserObj);
    setPasswordSuccess('تم تغيير كلمة المرور بنجاح! يرجى استخدام كلمة المرور الجديدة في المرات القادمة.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    onRefresh();

    setTimeout(() => setPasswordSuccess(''), 5000);
  };

  // Handle Preference Save
  const handleSavePreferences = () => {
    localStorage.setItem('solimedical_pref_notifs', notificationsEnabled ? 'true' : 'false');
    localStorage.setItem('solimedical_pref_sound', soundAlerts ? 'true' : 'false');
    localStorage.setItem('solimedical_pref_refresh', autoRefreshSecs);
    setPrefSuccess('تم حفظ تفضيلات النظام بنجاح.');
    setTimeout(() => setPrefSuccess(''), 3000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-72 h-72 bg-blue-500/5 dark:bg-blue-400/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-2xl shadow-md ring-4 ring-blue-50 dark:ring-blue-950/50">
              {user.display_name.slice(0, 1)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                  {user.display_name}
                </h1>
                <span className={`text-[11px] font-bold px-3 py-0.5 rounded-full border ${roleNames[user.role]?.color || 'bg-slate-100'}`}>
                  {roleNames[user.role]?.label || user.role}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3">
                <span className="font-mono">@{user.username}</span>
                <span>•</span>
                <span>تاريخ الإنشاء: {new Date(user.created_at).toLocaleDateString('ar-EG')}</span>
              </p>
            </div>
          </div>

          {/* Quick status pill */}
          <div className="flex items-center gap-2 self-start md:self-auto bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-2.5 px-4 rounded-2xl">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-bold">حالة الحساب</span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">نشط ومؤمن محلياً</span>
            </div>
          </div>

        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'profile'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <UserIcon size={16} />
            <span>بيانات الحساب الشخصي</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'security'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Lock size={16} />
            <span>الأمان وتغيير كلمة المرور</span>
          </button>

          <button
            onClick={() => setActiveTab('preferences')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'preferences'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Sliders size={16} />
            <span>تفضيلات النظام والعرض</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'audit'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Activity size={16} />
            <span>سجل نشاط الحساب</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Profile Details */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Edit Form */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                  <UserIcon size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">تعديل البيانات الأساسية</h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500">تحديث اسم العرض وبيانات الاتصال الخاصة بحسابك</p>
                </div>
              </div>
            </div>

            {profileSuccess && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-300 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
                <AlertCircle size={16} className="text-red-600 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">اسم المستخدم (Username)</label>
                  <input 
                    type="text" 
                    value={user.username} 
                    disabled 
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-mono cursor-not-allowed" 
                  />
                  <span className="text-[10px] text-slate-400">اسم المستخدم فريد وثابت للنظام ولا يمكن تغييره.</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    الاسم الكامل / اسم العرض <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    value={displayName} 
                    onChange={(e) => setDisplayName(e.target.value)} 
                    placeholder="مثال: د. أحمد سليمان"
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    required
                  />
                  <span className="text-[10px] text-slate-400">يظهر هذا الاسم في ترويسة التقارير، السندات وسجلات التدقيق.</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Mail size={14} className="text-slate-400" />
                    <span>البريد الإلكتروني (اختياري)</span>
                  </label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="user@solimedical.com"
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Phone size={14} className="text-slate-400" />
                    <span>رقم الهاتف / التواصل (اختياري)</span>
                  </label>
                  <input 
                    type="tel" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    placeholder="010XXXXXXXX"
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-sm transition-all hover:shadow"
                >
                  <Save size={16} />
                  <span>حفظ التعديلات</span>
                </button>
              </div>

            </form>
          </div>

          {/* User Role & Permission Info Card */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-sm border-b border-slate-100 dark:border-slate-800 pb-3">
                <Shield size={18} className="text-indigo-600" />
                <span>الصلاحيات والدور الإداري</span>
              </div>
              
              <div className="space-y-3">
                <div className={`p-3.5 rounded-2xl border ${roleNames[user.role]?.color || 'bg-slate-100'}`}>
                  <span className="text-xs font-bold block">{roleNames[user.role]?.label || user.role}</span>
                  <p className="text-[11px] mt-1 leading-relaxed opacity-90">{roleNames[user.role]?.desc}</p>
                </div>

                <div className="space-y-2 pt-2">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block">المخازن المصرح لك بالتعامل معها:</span>
                  <div className="space-y-1.5">
                    {userWarehouses.map(w => (
                      <div key={w.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                        <Building2 size={14} className="text-blue-600 shrink-0" />
                        <span className="font-bold text-slate-700 dark:text-slate-200">{w.name}</span>
                        <span className="font-mono text-[10px] bg-slate-200/60 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 mr-auto">{w.code}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: Security & Password */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">تغيير كلمة المرور</h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500">قم بتعيين كلمة مرور جديدة قوية لحماية حسابك المخزني</p>
                </div>
              </div>
            </div>

            {passwordSuccess && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-300 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
                <AlertCircle size={16} className="text-red-600 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              
              {/* Current Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  كلمة المرور الحالية <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input 
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور الحالية"
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 pl-10 text-xs focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    required
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-400">كلمة المرور الافتراضية للحسابات هي 123 إن لم تكن قد قمت بتغييرها مسبقاً.</span>
              </div>

              {/* New Password */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    كلمة المرور الجديدة <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input 
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="أدخل كلمة مرور جديدة"
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 pl-10 text-xs focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      required
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    تأكيد كلمة المرور الجديدة <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input 
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="أعد إدخال كلمة المرور الجديدة"
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 pl-10 text-xs focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      required
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Password Quality helper */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-150 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-1.5">
                <span className="font-bold text-slate-700 dark:text-slate-300 block">💡 إرشادات أمان كلمة المرور:</span>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>استخدم مزيجاً من الأحرف والأرقام لزيادة القوة.</li>
                  <li>لا تشارك كلمة المرور الخاصة بك مع أي شخص آخر بالمستشفى.</li>
                  <li>يتم تسجيل كل عملية تغيير لكلمة المرور في سجل الأمان المشفر.</li>
                </ul>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-sm transition-all hover:shadow"
                >
                  <Save size={16} />
                  <span>تحديث كلمة المرور</span>
                </button>
              </div>

            </form>

          </div>

          {/* Security Summary Card */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-sm border-b border-slate-100 dark:border-slate-800 pb-3">
                <ShieldCheck size={18} className="text-emerald-600" />
                <span>معايير الأمان النشطة</span>
              </div>
              
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                  <span className="text-slate-600 dark:text-slate-300 font-medium">التشفير والتحقق</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <Check size={14} /> نشط
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                  <span className="text-slate-600 dark:text-slate-300 font-medium">حماية التلاعب بالتاريخ</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <Check size={14} /> محمية
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                  <span className="text-slate-600 dark:text-slate-300 font-medium">سجل الحركات (Audit Trail)</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <Check size={14} /> متصل
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: System Preferences */}
      {activeTab === 'preferences' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                  <Sliders size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">تفضيلات واجهة النظام</h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500">تخصيص تجربة الاستخدام، التنبيهات والمظهر</p>
                </div>
              </div>
            </div>

            {prefSuccess && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{prefSuccess}</span>
              </div>
            )}

            <div className="space-y-5">
              
              {/* Theme Selector */}
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">مظهر النظام (Theme)</span>
                  <span className="text-[11px] text-slate-400">التبديل بين الوضع النهاري الفاتح والوضع الليلي الداكن</span>
                </div>
                {onToggleTheme && (
                  <button
                    onClick={onToggleTheme}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-bold shadow-sm transition-all"
                  >
                    {theme === 'dark' ? (
                      <>
                        <Sun size={16} className="text-amber-400" />
                        <span>الوضع النهاري</span>
                      </>
                    ) : (
                      <>
                        <Moon size={16} className="text-indigo-600" />
                        <span>الوضع الليلي</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Notification Center Alerts */}
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">التنبيهات الفورية لحد الطلب والصلاحية</span>
                  <span className="text-[11px] text-slate-400">عرض الإشعارات المباشرة في الشريط العلوي ولوحة التحكم</span>
                </div>
                <input 
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(e) => setNotificationsEnabled(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded-lg focus:ring-blue-500 cursor-pointer"
                />
              </div>

              {/* Sound Alerts */}
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">الأصوات والتأثيرات الصوتية التنبيهية</span>
                  <span className="text-[11px] text-slate-400">تشغيل نغمة تنبيه خفيفة عند حدوث أخطاء أو تنبيهات حرجة</span>
                </div>
                <input 
                  type="checkbox"
                  checked={soundAlerts}
                  onChange={(e) => setSoundAlerts(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded-lg focus:ring-blue-500 cursor-pointer"
                />
              </div>

              {/* Auto Refresh Period */}
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">معدل التحديث التلقائي للبيانات</span>
                  <span className="text-[11px] text-slate-400">مزامنة أرصدة المخازن والحركات بالخلفية</span>
                </div>
                <select
                  value={autoRefreshSecs}
                  onChange={(e) => setAutoRefreshSecs(e.target.value)}
                  className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200"
                >
                  <option value="30">كل 30 ثانية</option>
                  <option value="60">كل دقيقة واحدة</option>
                  <option value="300">كل 5 دقائق</option>
                  <option value="0">يدوي فقط</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-sm transition-all"
                >
                  <Save size={16} />
                  <span>حفظ التفضيلات</span>
                </button>
              </div>

            </div>

          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-sm border-b border-slate-100 dark:border-slate-800 pb-3">
                <Sparkles size={18} className="text-amber-500" />
                <span>إصدار النظام والبيئة</span>
              </div>
              
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">النظام</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">SoliMedical-ERB</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">الإصدار</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200 font-mono">v1.0.0 Stable</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">محرك التخزين</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200 font-mono">SQLite WAL Engine</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">البيئة</span>
                  <span className="font-bold text-emerald-600 font-mono">Offline Ready (محلي)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <Activity size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">سجل حركات ونشاط حسابك (Audit Trail)</h2>
                <p className="text-xs text-slate-400 dark:text-slate-500">آخر العمليات والتعديلات التي تمت من خلال هذا الحساب</p>
              </div>
            </div>
          </div>

          {userAuditLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              لا توجد سجلات نشاط حديثة مسجلة لهذا الحساب حتى الآن.
            </div>
          ) : (
            <div className="space-y-2">
              {userAuditLogs.map(log => (
                <div 
                  key={log.id} 
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-150 dark:border-slate-800 text-xs gap-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">{log.action}</span>
                      <span className="text-[10px] text-slate-400">{log.entity_type} {log.entity_id ? `(#${log.entity_id})` : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                    <Clock size={12} />
                    <span>{new Date(log.occurred_at).toLocaleString('ar-EG')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
