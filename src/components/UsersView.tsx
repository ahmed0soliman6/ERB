import React, { useState } from 'react';
import { Plus, Users, Shield, MapPin, Check, AlertCircle, ToggleLeft, ToggleRight } from 'lucide-react';
import { DBSchema, User, saveDB } from '../data/db';

interface UsersViewProps {
  db: DBSchema;
  user: any;
  onRefresh: () => void;
}

export const UsersView: React.FC<UsersViewProps> = ({ db, user, onRefresh }) => {
  const [showAddUser, setShowAddUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Add User Form State
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'STORE_MANAGER' | 'STORE_USER' | 'VIEWER'>('STORE_USER');
  const [allowedWarehouses, setAllowedWarehouses] = useState<number[]>([]);

  // Check if current user has management permissions
  const canManage = user.role === 'ADMIN';

  const handleAddUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!canManage) {
      setErrorMsg('خطأ: لا تمتلك الصلاحيات الإدارية لإنشاء مستخدمين الجدد.');
      return;
    }

    const usernameExists = db.users.some(u => u.username.trim().toLowerCase() === username.trim().toLowerCase());
    if (usernameExists) {
      setErrorMsg('خطأ: اسم المستخدم هذا مسجل مسبقاً! يرجى اختيار اسم مستخدم فريد.');
      return;
    }

    const newUser: User = {
      id: db.users.length > 0 ? Math.max(...db.users.map(u => u.id)) + 1 : 1,
      username: username.trim().toLowerCase(),
      display_name: displayName.trim(),
      password_hash: '202cb962ac59075b964b07152d234b70', // MD5 for '123' or simulated
      role: role,
      is_active: true,
      allowed_warehouses: role === 'ADMIN' ? [] : allowedWarehouses,
      created_at: new Date().toISOString()
    };

    db.users.push(newUser);

    // Log to Audit
    db.audit_logs.push({
      id: db.audit_logs.length > 0 ? Math.max(...db.audit_logs.map(a => a.id)) + 1 : 1,
      user_id: user.id,
      username: user.display_name,
      action: 'إنشاء مستخدم جديد',
      entity_type: 'حساب مستخدم',
      entity_id: newUser.id,
      after_json: JSON.stringify({ username: newUser.username, role: newUser.role }),
      occurred_at: new Date().toISOString()
    });

    saveDB(db);
    setSuccessMsg(`تم إنشاء حساب المستخدم "${displayName}" وتعيين دوره بنجاح.`);
    setShowAddUser(false);
    onRefresh();
    // Reset
    setUsername('');
    setDisplayName('');
    setPassword('');
    setAllowedWarehouses([]);
  };

  const handleToggleActive = (userId: number) => {
    if (!canManage) return;
    if (userId === user.id) {
      setErrorMsg('خطأ: لا يمكنك تعطيل حسابك النشط الحالي!');
      return;
    }

    const freshDb = db;
    const uIdx = freshDb.users.findIndex(u => u.id === userId);
    if (uIdx !== -1) {
      const targetUser = freshDb.users[uIdx];
      targetUser.is_active = !targetUser.is_active;

      freshDb.audit_logs.push({
        id: freshDb.audit_logs.length > 0 ? Math.max(...freshDb.audit_logs.map(a => a.id)) + 1 : 1,
        user_id: user.id,
        username: user.display_name,
        action: targetUser.is_active ? 'تفعيل مستخدم' : 'تعطيل مستخدم',
        entity_type: 'حساب مستخدم',
        entity_id: targetUser.id,
        occurred_at: new Date().toISOString()
      });

      saveDB(freshDb);
      setSuccessMsg(`تم تغيير حالة تفعيل الحساب للمستخدم "${targetUser.display_name}".`);
      onRefresh();
    }
  };

  const handleWarehouseCheckboxChange = (whId: number, isChecked: boolean) => {
    if (isChecked) {
      setAllowedWarehouses([...allowedWarehouses, whId]);
    } else {
      setAllowedWarehouses(allowedWarehouses.filter(id => id !== whId));
    }
  };

  const handleSaveWarehousePermissions = (userId: number, whs: number[]) => {
    if (!canManage) return;
    const freshDb = db;
    const uIdx = freshDb.users.findIndex(u => u.id === userId);
    if (uIdx !== -1) {
      freshDb.users[uIdx].allowed_warehouses = whs;
      saveDB(freshDb);
      setSuccessMsg(`تم تحديث صلاحيات المستودعات للمستخدم "${freshDb.users[uIdx].display_name}".`);
      setSelectedUser(null);
      onRefresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">إدارة المستخدمين والصلاحيات (RBAC)</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs">تعيين الأدوار، التحكم بقيد المستودعات المسموحة، وإجراء التدقيق الأمني.</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowAddUser(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm transition-all self-start md:self-auto cursor-pointer"
          >
            <Plus size={18} />
            إضافة مستخدم جديد
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

      {/* Users RBAC Table list */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={`${selectedUser ? 'lg:col-span-7' : 'lg:col-span-12'} bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 shadow-sm rounded-xl overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs border-b border-slate-150 dark:border-slate-800">
                  <th className="p-4">اسم المستخدم</th>
                  <th className="p-4">الاسم الكامل</th>
                  <th className="p-4">الدور الوظيفي</th>
                  <th className="p-4">المستودعات المرخصة</th>
                  <th className="p-4">حالة الحساب</th>
                  <th className="p-4 text-center">تعديل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm text-slate-700 dark:text-slate-300">
                {db.users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-4 font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">@{u.username}</td>
                    <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">{u.display_name}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                        u.role === 'ADMIN'
                          ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-900'
                          : u.role === 'STORE_MANAGER'
                          ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-100 dark:border-teal-900'
                          : u.role === 'STORE_USER'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}>
                        <Shield size={12} />
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
                      {u.role === 'ADMIN' ? (
                        <span className="text-slate-400 dark:text-slate-500">جميع المستودعات (مسؤول)</span>
                      ) : u.allowed_warehouses.length === 0 ? (
                        <span className="text-amber-600 dark:text-amber-400">غير مخصص لأي مستودع!</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.allowed_warehouses.map(whId => (
                            <span key={whId} className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded font-bold text-[10px]">
                              {db.warehouses.find(w => w.id === whId)?.name.split(' ')[1] || whId}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => handleToggleActive(u.id)}
                        disabled={!canManage || u.id === user.id}
                        className={`inline-flex items-center gap-1.5 focus:outline-none ${canManage && u.id !== user.id ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'}`}
                      >
                        {u.is_active ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 text-xs">
                            <ToggleRight className="text-emerald-500" size={20} />
                            نشط
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 font-bold flex items-center gap-1 text-xs">
                            <ToggleLeft className="text-slate-300 dark:text-slate-600" size={20} />
                            معطل
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="p-4 text-center">
                      {canManage && u.role !== 'ADMIN' && (
                        <button
                          onClick={() => {
                            setSelectedUser(u);
                            setAllowedWarehouses(u.allowed_warehouses);
                          }}
                          className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-bold cursor-pointer"
                        >
                          تخصيص المستودعات
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected User Warehouse Configuration Panel */}
        {selectedUser && (
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 shadow-sm rounded-xl p-5 space-y-4 animate-in slide-in-from-left-4 duration-150">
            <div className="flex justify-between items-start border-b border-slate-150 dark:border-slate-800 pb-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">قيد المستودعات وتخصيص الصلاحيات</span>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">{selectedUser.display_name}</h3>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">✕</button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block flex items-center gap-1">
                <MapPin size={14} className="text-teal-500" />
                المستودعات المصرح له بالعمل عليها:
              </label>

              <div className="space-y-2 border border-slate-150 dark:border-slate-800 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/40">
                {db.warehouses.map((wh) => (
                  <label key={wh.id} className="flex items-center gap-2.5 p-2 bg-white dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800 select-none">
                    <input
                      type="checkbox"
                      checked={allowedWarehouses.includes(wh.id)}
                      onChange={(e) => handleWarehouseCheckboxChange(wh.id, e.target.checked)}
                      className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 border-slate-300 dark:border-slate-600"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block">{wh.name}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">CODE: {wh.code}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-150 dark:border-slate-800 flex gap-2">
              <button
                onClick={() => setSelectedUser(null)}
                className="w-1/3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-2 rounded-lg text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleSaveWarehousePermissions(selectedUser.id, allowedWarehouses)}
                className="w-2/3 bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-lg text-xs font-bold shadow-sm cursor-pointer"
              >
                حفظ تعديلات الصلاحية
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-150 dark:border-slate-800 p-4 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">إنشاء حساب مستخدم جديد بالنظام</h3>
              <button onClick={() => setShowAddUser(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleAddUserSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">اسم المستخدم (Username - إنجليزي)</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثال: ahmed_user"
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2.5 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-teal-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">الاسم الكامل (Display Name - عربي)</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="مثال: أ. أحمد عبد الكريم"
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">الدور الوظيفي (Role)</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="STORE_USER">STORE_USER (أمين مخزن)</option>
                    <option value="STORE_MANAGER">STORE_MANAGER (مدير مخازن)</option>
                    <option value="VIEWER">VIEWER (مراقب حسابات)</option>
                    <option value="ADMIN">ADMIN (مسؤول عام)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">كلمة المرور المؤقتة</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="افتراضية: 123"
                    disabled
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold"
                  />
                </div>
              </div>

              {/* Warehouse selector for Non-Admins */}
              {role !== 'ADMIN' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">مستودعات العمل المرخصة له:</label>
                  <div className="grid grid-cols-2 gap-2 border border-slate-150 dark:border-slate-800 p-2.5 rounded-lg bg-slate-50/50 dark:bg-slate-800/40 max-h-[120px] overflow-y-auto">
                    {db.warehouses.map((wh) => (
                      <label key={wh.id} className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={allowedWarehouses.includes(wh.id)}
                          onChange={(e) => handleWarehouseCheckboxChange(wh.id, e.target.checked)}
                          className="rounded text-teal-600 w-3.5 h-3.5 border-slate-300 dark:border-slate-600"
                        />
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{wh.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-150 dark:border-slate-800 pt-4 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddUser(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
                >
                  إنشاء الحساب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
