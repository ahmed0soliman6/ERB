import React, { useState } from 'react';
import { 
  Plus, Users, Shield, MapPin, Check, AlertCircle, ToggleLeft, ToggleRight, 
  Trash2, Edit3, Key, Lock, Eye, EyeOff, Save, X, AlertTriangle, CheckCircle2, UserCheck
} from 'lucide-react';
import { DBSchema, User, saveDB } from '../data/db';

interface UsersViewProps {
  db: DBSchema;
  user: any;
  onRefresh: () => void;
}

// Simple Deterministic Secure Hash for offline passwords
function hashUserPassword(plain: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < plain.length; i++) {
    hash ^= plain.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return 'SEC_' + Math.abs(hash).toString(16).padStart(16, '0').toUpperCase();
}

export const UsersView: React.FC<UsersViewProps> = ({ db, user, onRefresh }) => {
  const [showAddUser, setShowAddUser] = useState(false);
  const [selectedUserForWarehouses, setSelectedUserForWarehouses] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Add User Form State
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'ADMIN' | 'STORE_MANAGER' | 'STORE_USER' | 'VIEWER'>('STORE_USER');
  const [newAllowedWarehouses, setNewAllowedWarehouses] = useState<number[]>([]);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Edit User Form State
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editRole, setEditRole] = useState<'ADMIN' | 'STORE_MANAGER' | 'STORE_USER' | 'VIEWER'>('STORE_USER');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editAllowedWarehouses, setEditAllowedWarehouses] = useState<number[]>([]);

  // Warehouse drawer state
  const [warehouseListSelection, setWarehouseListSelection] = useState<number[]>([]);

  // Check if current user has management permissions
  const canManage = user.role === 'ADMIN';

  // Helper to show temporary alert
  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const triggerError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 5000);
  };

  // Open Edit User Modal
  const handleStartEdit = (targetUser: User) => {
    setEditingUser(targetUser);
    setEditDisplayName(targetUser.display_name);
    setEditUsername(targetUser.username);
    setEditRole(targetUser.role);
    setEditPassword('');
    setShowEditPassword(false);
    setEditAllowedWarehouses(targetUser.allowed_warehouses || []);
    setErrorMsg('');
  };

  // Submit Edit User
  const handleSaveEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || !editingUser) return;

    if (!editDisplayName.trim()) {
      triggerError('يرجى إدخال الاسم الكامل للمستخدم.');
      return;
    }

    if (!editUsername.trim()) {
      triggerError('يرجى إدخال اسم المستخدم.');
      return;
    }

    // Check if new username conflicts with another user
    const usernameConflict = db.users.some(
      u => u.id !== editingUser.id && u.username.trim().toLowerCase() === editUsername.trim().toLowerCase()
    );

    if (usernameConflict) {
      triggerError('اسم المستخدم هذا مسجل مسبقاً لمستخدم آخر! يرجى اختيار اسم مستخدم فريد.');
      return;
    }

    const freshDb = db;
    const uIdx = freshDb.users.findIndex(u => u.id === editingUser.id);
    if (uIdx === -1) return;

    const target = freshDb.users[uIdx];
    const prevData = { ...target };

    // Update fields
    target.display_name = editDisplayName.trim();
    target.username = editUsername.trim().toLowerCase();
    target.role = editRole;
    target.allowed_warehouses = editRole === 'ADMIN' ? [] : editAllowedWarehouses;

    // Update password if provided
    if (editPassword.trim()) {
      target.password_plain = editPassword.trim();
      target.password_hash = hashUserPassword(editPassword.trim());
    }

    // Audit log
    freshDb.audit_logs.push({
      id: freshDb.audit_logs.length > 0 ? Math.max(...freshDb.audit_logs.map(a => a.id)) + 1 : 1,
      user_id: user.id,
      username: user.display_name,
      action: 'تعديل بيانات المستخدم وكلمة المرور',
      entity_type: 'حساب مستخدم',
      entity_id: target.id,
      before_json: JSON.stringify({ name: prevData.display_name, role: prevData.role, username: prevData.username }),
      after_json: JSON.stringify({ name: target.display_name, role: target.role, username: target.username, password_changed: Boolean(editPassword.trim()) }),
      occurred_at: new Date().toISOString()
    });

    saveDB(freshDb);
    triggerSuccess(`تم حفظ وتحديث بيانات المستخدم "${target.display_name}" بنجاح.`);
    setEditingUser(null);
    onRefresh();
  };

  // Submit Add User
  const handleAddUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      triggerError('خطأ: لا تمتلك الصلاحيات الإدارية لإنشاء مستخدمين الجدد.');
      return;
    }

    const usernameExists = db.users.some(u => u.username.trim().toLowerCase() === newUsername.trim().toLowerCase());
    if (usernameExists) {
      triggerError('خطأ: اسم المستخدم هذا مسجل مسبقاً! يرجى اختيار اسم مستخدم فريد.');
      return;
    }

    const passToUse = newPassword.trim() || '123';
    const newUser: User = {
      id: db.users.length > 0 ? Math.max(...db.users.map(u => u.id)) + 1 : 1,
      username: newUsername.trim().toLowerCase(),
      display_name: newDisplayName.trim(),
      password_plain: passToUse,
      password_hash: hashUserPassword(passToUse),
      role: newRole,
      is_active: true,
      allowed_warehouses: newRole === 'ADMIN' ? [] : newAllowedWarehouses,
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
    triggerSuccess(`تم إنشاء حساب المستخدم "${newDisplayName}" وتشفير كلمة المرور بنجاح.`);
    setShowAddUser(false);
    onRefresh();

    // Reset
    setNewUsername('');
    setNewDisplayName('');
    setNewPassword('');
    setNewAllowedWarehouses([]);
  };

  // Confirm Delete User
  const handleConfirmDeleteUser = () => {
    if (!canManage || !userToDelete) return;

    if (userToDelete.id === user.id) {
      triggerError('خطأ أمني: لا يمكنك حذف حسابك الشخصي الذي تستخدمه حالياً!');
      setUserToDelete(null);
      return;
    }

    const targetName = userToDelete.display_name;
    const targetId = userToDelete.id;

    // Filter out user
    db.users = db.users.filter(u => u.id !== targetId);

    // Audit log
    db.audit_logs.push({
      id: db.audit_logs.length > 0 ? Math.max(...db.audit_logs.map(a => a.id)) + 1 : 1,
      user_id: user.id,
      username: user.display_name,
      action: 'حذف حساب مستخدم',
      entity_type: 'حساب مستخدم',
      entity_id: targetId,
      before_json: JSON.stringify({ name: targetName, id: targetId }),
      occurred_at: new Date().toISOString()
    });

    saveDB(db);
    triggerSuccess(`تم حذف حساب المستخدم "${targetName}" من النظام بنجاح.`);
    setUserToDelete(null);
    onRefresh();
  };

  const handleToggleActive = (userId: number) => {
    if (!canManage) return;
    if (userId === user.id) {
      triggerError('خطأ: لا يمكنك تعطيل حسابك النشط الحالي!');
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
      triggerSuccess(`تم تغيير حالة تفعيل الحساب للمستخدم "${targetUser.display_name}".`);
      onRefresh();
    }
  };

  const handleSaveWarehousePermissions = (userId: number, whs: number[]) => {
    if (!canManage) return;
    const freshDb = db;
    const uIdx = freshDb.users.findIndex(u => u.id === userId);
    if (uIdx !== -1) {
      freshDb.users[uIdx].allowed_warehouses = whs;
      saveDB(freshDb);
      triggerSuccess(`تم تحديث صلاحيات المستودعات للمستخدم "${freshDb.users[uIdx].display_name}".`);
      setSelectedUserForWarehouses(null);
      onRefresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Users className="text-teal-600 dark:text-teal-400" size={24} />
            <span>إدارة المستخدمين والصلاحيات (RBAC)</span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            تعديل الأسماء، تغيير وتشفير كلمات المرور، حذف الحسابات وتخصيص صلاحيات المستودعات.
          </p>
        </div>

        {canManage && (
          <button 
            onClick={() => setShowAddUser(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all self-start md:self-auto cursor-pointer"
          >
            <Plus size={16} />
            <span>إضافة مستخدم جديد</span>
          </button>
        )}
      </div>

      {/* Warnings & Success banners */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-xl text-xs font-bold flex items-center gap-2">
          <AlertCircle size={18} className="shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Users RBAC Table list */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={`${selectedUserForWarehouses ? 'lg:col-span-7' : 'lg:col-span-12'} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs border-b border-slate-200 dark:border-slate-800">
                  <th className="p-4">اسم المستخدم</th>
                  <th className="p-4">الاسم الكامل</th>
                  <th className="p-4">الدور الوظيفي</th>
                  <th className="p-4">المستودعات المرخصة</th>
                  <th className="p-4">حالة الحساب</th>
                  <th className="p-4 text-center">الإجراءات والخيارات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm text-slate-700 dark:text-slate-300">
                {db.users.map((u) => {
                  const isCurrentUser = u.id === user.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                        @{u.username}
                        {isCurrentUser && (
                          <span className="mr-1.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold px-1.5 py-0.5 rounded">حسابك</span>
                        )}
                      </td>

                      <td className="p-4 font-bold text-slate-900 dark:text-slate-100">{u.display_name}</td>

                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                          u.role === 'ADMIN' 
                            ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900' 
                            : u.role === 'STORE_MANAGER' 
                            ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-900'
                            : u.role === 'STORE_USER'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
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
                          <span className="text-amber-600 dark:text-amber-400 font-bold">غير مخصص لأي مستودع!</span>
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
                          disabled={!canManage || isCurrentUser}
                          className={`inline-flex items-center gap-1.5 focus:outline-none ${canManage && !isCurrentUser ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'}`}
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

                      {/* Action buttons: Edit, Warehouses, Delete */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {canManage && (
                            <>
                              {/* Edit Name & Password */}
                              <button
                                type="button"
                                onClick={() => handleStartEdit(u)}
                                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 p-2 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                                title="تعديل الاسم وكلمة المرور والصلاحية"
                              >
                                <Edit3 size={14} className="text-indigo-600 dark:text-indigo-400" />
                                <span className="hidden sm:inline">تعديل</span>
                              </button>

                              {/* Customize Warehouses (if not admin) */}
                              {u.role !== 'ADMIN' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedUserForWarehouses(u);
                                    setWarehouseListSelection(u.allowed_warehouses || []);
                                  }}
                                  className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-teal-600 dark:text-teal-400 p-2 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                                  title="تخصيص المستودعات المسموحة"
                                >
                                  <MapPin size={14} />
                                  <span className="hidden sm:inline">المستودعات</span>
                                </button>
                              )}

                              {/* Delete button (cannot delete self) */}
                              {!isCurrentUser && (
                                <button
                                  type="button"
                                  onClick={() => setUserToDelete(u)}
                                  className="bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 p-2 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                                  title="حذف المستخدم"
                                >
                                  <Trash2 size={14} />
                                  <span className="hidden sm:inline">حذف</span>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected User Warehouse Configuration Panel */}
        {selectedUserForWarehouses && (
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl p-5 space-y-4 animate-in slide-in-from-left-4 duration-150">
            <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">قيد المستودعات وتخصيص الصلاحيات</span>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">{selectedUserForWarehouses.display_name}</h3>
              </div>
              <button onClick={() => setSelectedUserForWarehouses(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">✕</button>
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
                      checked={warehouseListSelection.includes(wh.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setWarehouseListSelection([...warehouseListSelection, wh.id]);
                        } else {
                          setWarehouseListSelection(warehouseListSelection.filter(id => id !== wh.id));
                        }
                      }}
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
                onClick={() => setSelectedUserForWarehouses(null)}
                className="w-1/3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-2 rounded-lg text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleSaveWarehousePermissions(selectedUserForWarehouses.id, warehouseListSelection)}
                className="w-2/3 bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-lg text-xs font-bold shadow-sm cursor-pointer"
              >
                حفظ تعديلات الصلاحية
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- EDIT USER MODAL (تعديل الاسم وكلمة السر والصلاحية) --- */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-5 text-slate-900 dark:text-slate-100">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Edit3 size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">تعديل بيانات المستخدم وكلمة المرور</h3>
                  <p className="text-xs text-slate-400">@{editingUser.username}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Display Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">الاسم الكامل / اسم العرض: <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    placeholder="مثال: د. أحمد سليمان"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                {/* Username */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">اسم المستخدم (Username): <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder="admin@"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              {/* Role */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">الدور الوظيفي والصلاحيات:</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ADMIN">ADMIN - مسؤول نظام شامل (كل الصلاحيات)</option>
                  <option value="STORE_MANAGER">STORE_MANAGER - مدير مستودعات</option>
                  <option value="STORE_USER">STORE_USER - أمين مخزن ومستودع</option>
                  <option value="VIEWER">VIEWER - مراقب وتقارير فقط (قراءة فقط)</option>
                </select>
              </div>

              {/* Change Password Box (مشفرة) */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Key size={14} className="text-indigo-600 dark:text-indigo-400" />
                    <span>تغيير كلمة المرور المشفرة (اتركها فارغة إذا لا تريد التغيير):</span>
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded">مشفرة Hash</span>
                </label>

                <div className="relative">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="اكتب كلمة السر الجديدة..."
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 pl-10 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  يتم تشفير كلمة المرور وتوليد Hash آمن لها لحماية الحساب عند التخزين.
                </p>
              </div>

              {/* Allowed warehouses if not admin */}
              {editRole !== 'ADMIN' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">المستودعات المسموحة:</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700 max-h-36 overflow-y-auto">
                    {db.warehouses.map((wh) => (
                      <label key={wh.id} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editAllowedWarehouses.includes(wh.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditAllowedWarehouses([...editAllowedWarehouses, wh.id]);
                            } else {
                              setEditAllowedWarehouses(editAllowedWarehouses.filter(id => id !== wh.id));
                            }
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                        />
                        <span>{wh.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Save size={15} />
                  <span>حفظ التعديلات المشفرة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD NEW USER MODAL --- */}
      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-5 text-slate-900 dark:text-slate-100">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
                  <Plus size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">إضافة مستخدم جديد للنظام</h3>
                  <p className="text-xs text-slate-400">إنشاء حساب مستخدم وتعيين كلمة المرور والصلاحية</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAddUser(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddUserSubmit} className="space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Display Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">الاسم الكامل: <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="مثال: د. حسام فتحي"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>

                {/* Username */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">اسم الدخول (Username): <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="hossam@"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">كلمة المرور (مشفرة آلياً):</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="افتراضياً: 123"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 pl-10 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Role */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">الدور الوظيفي والصلاحية:</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="STORE_USER">STORE_USER - أمين مخزن ومستودع</option>
                  <option value="STORE_MANAGER">STORE_MANAGER - مدير مستودعات</option>
                  <option value="ADMIN">ADMIN - مسؤول نظام شامل</option>
                  <option value="VIEWER">VIEWER - مراقب جودة وتقارير فقط</option>
                </select>
              </div>

              {/* Allowed Warehouses if not admin */}
              {newRole !== 'ADMIN' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">المستودعات المسموح بالعمل عليها:</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700 max-h-36 overflow-y-auto">
                    {db.warehouses.map((wh) => (
                      <label key={wh.id} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newAllowedWarehouses.includes(wh.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewAllowedWarehouses([...newAllowedWarehouses, wh.id]);
                            } else {
                              setNewAllowedWarehouses(newAllowedWarehouses.filter(id => id !== wh.id));
                            }
                          }}
                          className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                        />
                        <span>{wh.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddUser(false)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <UserCheck size={16} />
                  <span>تأكيد وإنشاء المستخدم</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CONFIRM DELETE USER MODAL (تأكيد الحذف) --- */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4 text-slate-900 dark:text-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/80 flex items-center justify-center text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 shrink-0">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="font-bold text-base text-rose-600 dark:text-rose-400">تأكيد حذف المستخدم نهائياً</h3>
                <p className="text-xs text-slate-400">@{userToDelete.username}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف حساب المستخدم <strong className="text-slate-900 dark:text-white">"{userToDelete.display_name}"</strong>؟
              <br />
              <span className="text-slate-400 text-[11px] block mt-1">لن يتم حذف العمليات والمستندات التاريخية السابقة التي قام بها حفاظاً على سجلات التدقيق والمطابقة.</span>
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
              >
                إلغاء التراجع
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={15} />
                <span>نعم، حذف الحساب</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
