import React, { useState } from 'react';
import { User, DBSchema, saveDB } from '../data/db';
import { Save, User as UserIcon, Shield, CheckCircle } from 'lucide-react';

interface SettingsViewProps {
  db: DBSchema;
  user: User;
  onRefresh: () => void;
  onUserUpdate: (updatedUser: User) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ db, user, onRefresh, onUserUpdate }) => {
  const [displayName, setDisplayName] = useState(user.display_name);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (!displayName.trim()) {
      setErrorMsg('اسم المستخدم لا يمكن أن يكون فارغاً.');
      return;
    }

    try {
      // Find and update the user in the database
      const userIndex = db.users.findIndex(u => u.id === user.id);
      if (userIndex !== -1) {
        db.users[userIndex].display_name = displayName;
        saveDB(db);

        
        // Update session storage to prevent stale data on reload
        const sessionToken = sessionStorage.getItem('solimedical_session');
        if (sessionToken) {
          try {
            const sessionData = JSON.parse(sessionToken);
            sessionData.user = db.users[userIndex];
            sessionStorage.setItem('solimedical_session', JSON.stringify(sessionData));
          } catch (e) {
            console.error("Error updating session storage", e);
          }
        }

        // Notify parent components
        onUserUpdate(db.users[userIndex]);
        onRefresh();

        
        setSuccessMsg('تم تحديث إعدادات الحساب بنجاح.');
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setErrorMsg('حدث خطأ أثناء محاولة العثور على حسابك.');
      }
    } catch (err) {
      setErrorMsg('حدث خطأ أثناء حفظ الإعدادات.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-100 dark:bg-blue-900/50 p-2.5 rounded-xl text-blue-600 dark:text-blue-400">
          <UserIcon size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">إعدادات الحساب</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-bold">تعديل ملفك الشخصي واسم العرض</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800 overflow-hidden">
        <div className="p-6">
          {successMsg && (
            <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 rounded-xl flex items-center gap-3 font-bold text-sm">
              <CheckCircle size={18} />
              <span>{successMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200/60 dark:border-red-800/60 rounded-xl flex items-center gap-3 font-bold text-sm">
              <Shield size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-5 max-w-xl">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">اسم الدخول (Username)</label>
              <input
                type="text"
                value={user.username}
                disabled
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-mono text-left opacity-70 cursor-not-allowed"
                dir="ltr"
              />
              <p className="text-[10px] font-bold text-slate-400 mt-1">لا يمكن تغيير اسم الدخول الخاص بك.</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">الاسم المعروض (Display Name)</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="أدخل الاسم الذي سيظهر في أعلى البرنامج..."
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                required
              />
              <p className="text-[10px] font-bold text-slate-400 mt-1">هذا هو الاسم الذي يظهر في لوحة التحكم والتقارير.</p>
            </div>

            
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">دور المستخدم</label>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 inline-block">
                <span className="text-sm font-bold text-blue-700 dark:text-blue-400 font-mono">{user.role}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition-colors shadow-sm"
              >
                <Save size={18} />
                <span>حفظ الإعدادات</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
