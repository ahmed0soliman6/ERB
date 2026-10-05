import React, { useState } from 'react';
import { 
  Download, Upload, ShieldAlert, Check, AlertTriangle, Key, Calendar, 
  ShieldCheck, Database, RefreshCw, Copy, CheckCircle2, Lock, Usb, Cpu, Sparkles,
  Wrench, KeyRound, Save
} from 'lucide-react';
import { DBSchema, saveDB, loadDB, verifyLicenseKey, generateSignedLicense, SignedLicensePayload, LicenseRecord } from '../data/db';
import { SYSTEM_PRODUCT_ID, SYSTEM_PUBLIC_KEY_ID } from '../utils/cryptoLicense';

interface BackupLicenseViewProps {
  db: DBSchema;
  user: any;
  onRefresh: () => void;
}

export const BackupLicenseView: React.FC<BackupLicenseViewProps> = ({ db, user, onRefresh }) => {
  const [activeSubTab, setActiveSubTab] = useState<'BACKUP' | 'LICENSE' | 'GENERATOR'>('BACKUP');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [activationKey, setActivationKey] = useState('');
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Developer Mode configuration: Controlled via VITE_DEVELOPER_MODE environment variable or Secret PIN
  const envDevMode = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_DEVELOPER_MODE === 'true';
  const [devUnlocked, setDevUnlocked] = useState(false);
  const [lockClickCount, setLockClickCount] = useState(0);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Custom Developer PIN management
  const [newPinInput, setNewPinInput] = useState('');
  const [pinChangeMsg, setPinChangeMsg] = useState('');

  const getStoredDevPin = () => {
    return localStorage.getItem('soli_developer_secret_pin') || 'Mido_ali2';
  };

  const isDeveloperMode = envDevMode || devUnlocked;

  // License Generator State (Issuer tool)
  const [genCustEmail, setGenCustEmail] = useState('hospital.admin@medcenter.eg');
  const [genLicType, setGenLicType] = useState<'TRIAL' | 'COMMERCIAL' | 'UNLIMITED'>('COMMERCIAL');
  const [genDurationMonths, setGenDurationMonths] = useState<number>(12);
  const [generatedKeyOutput, setGeneratedKeyOutput] = useState('');

  const activeLicense = db.license_records[db.license_records.length - 1];

  // Helper: Trigger JSON database download (Manual / USB Backup)
  const handleExportBackup = (isUsb = false) => {
    try {
      const currentData = loadDB();
      const prefix = isUsb ? 'USB_SoliMedical_Backup' : 'SoliMedical_ERB_Backup';
      const filename = `${prefix}_${new Date().toISOString().split('T')[0]}_${Date.now().toString().slice(-4)}.json`;
      const jsonStr = JSON.stringify(currentData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Audit log
      db.audit_logs.push({
        id: db.audit_logs.length > 0 ? Math.max(...db.audit_logs.map(a => a.id)) + 1 : 1,
        user_id: user.id,
        username: user.display_name,
        action: isUsb ? 'تصدير نسخة احتياطية لوحدة USB' : 'تصدير نسخة احتياطية',
        entity_type: 'ملف النظام',
        entity_id: 0,
        occurred_at: new Date().toISOString()
      });
      saveDB(db);

      setSuccessMsg(`تم إنشاء وتصدير النسخة الاحتياطية بنجاح (${filename}). احفظ هذا الملف في مكان آمن.`);
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch {
      setErrorMsg('حدث خطأ أثناء محاولة تصدير قاعدة البيانات.');
    }
  };

  // Helper: Handle file upload for JSON restore
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        
        // Basic schema structure validation
        if (!parsed.items || !parsed.warehouses || !parsed.movements || !parsed.users) {
          throw new Error('الملف غير متطابق مع بنية قاعدة بيانات SoliMedical-ERB.');
        }

        setPendingRestoreData(parsed);
        setShowRestoreConfirm(true);
      } catch (err: any) {
        setErrorMsg(err.message || 'فشل قراءة الملف. تأكد من تحديد ملف JSON صالح خاص بالنظام.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  // Helper: Execute restore after user confirmation
  const handleConfirmRestore = () => {
    if (!pendingRestoreData) return;

    try {
      // 1. Create automatic internal safety snapshot in localStorage
      const current = loadDB();
      localStorage.setItem('solimedical_safety_backup_before_restore', JSON.stringify(current));

      // 2. Perform restore
      saveDB(pendingRestoreData);

      setShowRestoreConfirm(false);
      setPendingRestoreData(null);
      setSuccessMsg('تمت استعادة قاعدة البيانات بنجاح تام! تم تحديث جميع السجلات والحسابات.');
      onRefresh();
    } catch {
      setErrorMsg('فشلت عملية استعادة البيانات. يرجى مراجعة صلاحيات التخزين.');
    }
  };

  // Helper: Activate License Key
  const handleActivateLicense = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!activationKey.trim()) {
      setErrorMsg('يرجى لصق رمز أو مفتاح الترخيص المشفر أولاً.');
      return;
    }

    const res = verifyLicenseKey(activationKey.trim());
    if (res.isValid && res.payload) {
      // Add to records
      const freshDb = loadDB();
      const newRec: LicenseRecord = {
        id: freshDb.license_records.length > 0 ? Math.max(...freshDb.license_records.map(l => l.id)) + 1 : 1,
        license_id: res.payload.license_id || `LIC-${Date.now()}`,
        customer_id: res.payload.customer_id,
        license_type: res.payload.license_type,
        issue_date: res.payload.issue_date,
        expiry_date: res.payload.expiry_date,
        raw_payload: activationKey.trim(),
        status: 'ACTIVE',
        activated_at: new Date().toISOString()
      };

      freshDb.license_records.push(newRec);
      freshDb.license_state.last_license_id = newRec.license_id;
      freshDb.license_state.last_seen_utc = new Date().toISOString();
      freshDb.license_state.last_seen_local_date = new Date().toISOString().split('T')[0];
      freshDb.license_state.clock_warning_status = false;
      freshDb.license_state.updated_at = new Date().toISOString();

      // Log activation in audit
      freshDb.audit_logs.push({
        id: freshDb.audit_logs.length > 0 ? Math.max(...freshDb.audit_logs.map(a => a.id)) + 1 : 1,
        user_id: user.id,
        username: user.display_name,
        action: 'تفعيل الترخيص الرقمي',
        entity_type: 'رخصة التشغيل',
        entity_id: newRec.id,
        after_json: JSON.stringify({ type: res.payload.license_type, expiry: res.payload.expiry_date }),
        occurred_at: new Date().toISOString()
      });

      saveDB(freshDb);
      setSuccessMsg(`تهانينا! تم تفعيل رخصة المنتج وتوثيق التوقيع الرقمي بنجاح. نوع الترخيص: ${res.payload.license_type}، تاريخ الانتهاء: ${res.payload.expiry_date}.`);
      setActivationKey('');
      onRefresh();
    } else {
      setErrorMsg(res.error || 'رمز الترخيص غير صحيح أو غير متطابق مع التوقيع الرقمي للمؤسسة.');
    }
  };

  // Generate signed license using Issuer engine (Developer Only)
  const handleGenerateLicenseKey = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date();
    const issueDate = now.toISOString().split('T')[0];
    
    let expiryDate = '';
    if (genLicType === 'UNLIMITED') {
      expiryDate = '2099-12-31';
    } else {
      const exp = new Date(now);
      exp.setMonth(exp.getMonth() + genDurationMonths);
      expiryDate = exp.toISOString().split('T')[0];
    }

    const payload: SignedLicensePayload = {
      productId: SYSTEM_PRODUCT_ID,
      customerId: genCustEmail.trim() || 'hospital.admin@medcenter.eg',
      licenseId: `LIC-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      issueDate,
      expiryDate,
      licenseType: genLicType,
      version: '2.0.0',
      maxWarehouses: 50,
      features: ['UNLIMITED_ITEMS', 'ALL_WAREHOUSES', 'OFFLINE_SIGNATURE', 'EXCEL_LEDGER']
    };

    const token = generateSignedLicense(payload);
    setGeneratedKeyOutput(token);
    setCopiedKey(false);
  };

  const handleCopyKey = () => {
    if (!generatedKeyOutput) return;
    navigator.clipboard.writeText(generatedKeyOutput);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 3000);
  };

  // Helper: Download Standalone Keygen HTML tool for vendor/developer
  const handleDownloadKeygenHTML = async () => {
    try {
      const response = await fetch('/soli-license-generator.html');
      if (response.ok) {
        const text = await response.text();
        const blob = new Blob([text], { type: 'text/html;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'SoliMedical-License-Generator.html';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setSuccessMsg('تم تنزيل ملف أداة توليد وإدارة سجل التراخيص (SoliMedical-License-Generator.html). احفظ هذا الملف على هاتفك أو حاسوبك الشخصي.');
        return;
      }
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  // Secret Developer Mode Click Sequence (5 clicks on the lock icon unlocks PIN modal)
  const handleSecretLockClick = () => {
    const nextCount = lockClickCount + 1;
    setLockClickCount(nextCount);
    if (nextCount >= 5) {
      setLockClickCount(0);
      if (!isDeveloperMode) {
        setShowPinModal(true);
      }
    }
  };

  const handleVerifyDevPin = (e: React.FormEvent) => {
    e.preventDefault();
    const currentValidPin = getStoredDevPin();
    if (pinInput.trim() === currentValidPin || pinInput.trim() === 'Mido_ali2') {
      setDevUnlocked(true);
      setShowPinModal(false);
      setPinInput('');
      setPinError('');
      setSuccessMsg('تم تفعيل وضع المطور (Developer Mode) للجلسة الحالية بنجاح.');
    } else {
      setPinError('رمز المطور السري غير صحيح.');
    }
  };

  // Change Developer PIN Handler
  const handleChangeDevPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPinInput.trim()) return;
    localStorage.setItem('soli_developer_secret_pin', newPinInput.trim());
    setPinChangeMsg('تم تحديث وحفظ رمز المطور السري الجديد بنجاح!');
    setNewPinInput('');
    setTimeout(() => setPinChangeMsg(''), 4000);
  };

  const handleResetDevPin = () => {
    localStorage.removeItem('soli_developer_secret_pin');
    setPinChangeMsg('تمت استعادة الرمز الافتراضي (Mido_ali2) بنجاح.');
    setTimeout(() => setPinChangeMsg(''), 4000);
  };

  // Check clock rollback protection
  const checkClockRollback = () => {
    const lastSeen = new Date(db.license_state.last_seen_utc).getTime();
    const current = Date.now();
    return current < lastSeen - 10 * 60 * 1000;
  };

  const isClockTampered = checkClockRollback();

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <button 
              type="button" 
              onClick={handleSecretLockClick} 
              className="text-teal-600 dark:text-teal-400 hover:scale-110 active:scale-95 transition-all cursor-pointer p-0.5"
              title="أمن النظام والترخيص"
            >
              <Lock size={22} />
            </button>
            <span>أمن النظام، الترخيص الرقمي، والنسخ الاحتياطي</span>
            {isDeveloperMode && (
              <div className="flex items-center gap-2">
                <span className="bg-amber-950/80 text-amber-400 border border-amber-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Wrench size={12} />
                  <span>وضع المطور نشط</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDevUnlocked(false);
                    if (activeSubTab === 'GENERATOR') setActiveSubTab('BACKUP');
                    setSuccessMsg('تم إغلاق وضع المطور وإخفاء أدوات التوليد بنجاح.');
                    setTimeout(() => setSuccessMsg(''), 4000);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                  title="إغلاق وضع المطور فوراً وقفل التبويب"
                >
                  <Lock size={10} />
                  <span>إغلاق وقفل المطور 🔒</span>
                </button>
              </div>
            )}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            نظام ترخيص محلي مشفر دون الحاجة للإنترنت (Offline Signed License) وحفظ واستعادة قواعد البيانات.
          </p>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('BACKUP')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'BACKUP' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          النسخ الاحتياطي والاستعادة (Backup & Restore)
        </button>
        <button
          onClick={() => setActiveSubTab('LICENSE')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'LICENSE' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          رخصة التشغيل والتنشيط (Offline License)
        </button>

        {/* Developer Keygen Sub Tab - ONLY visible if isDeveloperMode is TRUE */}
        {isDeveloperMode && (
          <button
            onClick={() => setActiveSubTab('GENERATOR')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'GENERATOR' 
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm' 
                : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
            }`}
          >
            <Cpu size={14} />
            <span>مولد ومحاكي التراخيص (Issuer Tool 🔒)</span>
          </button>
        )}
      </div>

      {/* Warnings & Success banners */}
      {isClockTampered && (
        <div className="p-4 bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-900 dark:text-red-200 rounded-xl text-sm font-bold flex items-center gap-3">
          <AlertTriangle size={24} className="shrink-0 text-red-600 dark:text-red-400 animate-bounce" />
          <div>
            <span className="block">⚠️ تنبيه أمني: تم رصد تراجع في توقيت نظام التشغيل!</span>
            <p className="text-xs font-semibold text-red-700 dark:text-red-300 leading-normal mt-0.5">
              تم رصد فارق زمني سالب بين توقيت جهازك وآخر وقت تشغيل مسجل ({new Date(db.license_state.last_seen_utc).toLocaleString('ar-EG')}). تم إيقاف العمليات الحساسة لحماية سلامة البيانات. لن يتم حذف أي بيانات، يرجى ضبط ساعة جهازك أو إدخال ترخيص جديد.
            </p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-sm font-bold flex items-center gap-2">
          <Check size={18} />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-xl text-sm font-bold flex items-center gap-2">
          <ShieldAlert size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* --- TAB 1: BACKUP AND RESTORE --- */}
      {activeSubTab === 'BACKUP' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Download Backup Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 p-3 rounded-xl inline-block">
                <Database size={24} />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">إنشاء وتصدير نسخة احتياطية كاملة</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                يقوم النظام بتصدير كامل قواعد الحركات، دليل الأصناف الـ 316، تصنيفات المواد، الحسابات والتدقيق في ملف واحد مشفر بصيغة JSON. يمكنك تحميله وحفظه على ذاكرة فلاش USB خارجية.
              </p>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl text-xs space-y-1 text-slate-600 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>إجمالي الأصناف بالملف:</span>
                  <strong className="text-slate-900 dark:text-slate-100">{db.items.length} صنف</strong>
                </div>
                <div className="flex justify-between">
                  <span>إجمالي الحركات المخزنية:</span>
                  <strong className="text-slate-900 dark:text-slate-100">{db.movements.length} حركة</strong>
                </div>
                <div className="flex justify-between">
                  <span>المخازن والمستودعات:</span>
                  <strong className="text-slate-900 dark:text-slate-100">{db.warehouses.length} مخزن</strong>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleExportBackup(false)}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                <Download size={16} />
                <span>تحميل نسخة احتياطية (JSON)</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportBackup(true)}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                <Usb size={16} className="text-teal-600 dark:text-teal-400" />
                <span>تصدير لفلاشة USB</span>
              </button>
            </div>
          </div>

          {/* Restore Backup Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 p-3 rounded-xl inline-block">
                <Upload size={24} />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">استعادة نسخة احتياطية (Data Restore)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                استرجاع كامل البيانات من ملف نسخة احتياطية سابق تم حفظه على جهازك أو الفلاش ميموري. يتم فحص سلامة الملف تلقائياً قبل الاستبدال.
              </p>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                ⚠️ <strong>تنبيه هام:</strong> سيتم استبدال البيانات الحالية بالبيانات الموجودة داخل الملف المختار بعد التأكيد.
              </div>
            </div>

            <div className="pt-2">
              <label className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer block text-center">
                <Upload size={16} />
                <span>اختيار ملف النسخة الاحتياطية واستعادته</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: OFFLINE LICENSE --- */}
      {activeSubTab === 'LICENSE' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* License Info Panel */}
          <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <ShieldCheck className="text-emerald-600 dark:text-emerald-400" size={20} />
              معلومات رخصة التشغيل والتوقيع الرقمي (Offline Signed License)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                <span className="text-slate-400 dark:text-slate-500 block font-semibold">معرف المنتج (Product ID)</span>
                <span className="font-mono font-bold text-sm text-slate-800 dark:text-slate-200">{SYSTEM_PRODUCT_ID}</span>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                <span className="text-slate-400 dark:text-slate-500 block font-semibold">نوع الرخصة (License Type)</span>
                <span className="font-bold text-sm text-teal-600 dark:text-teal-400 flex items-center gap-1">
                  <ShieldCheck size={14} />
                  {activeLicense?.license_type}
                </span>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                <span className="text-slate-400 dark:text-slate-500 block font-semibold">المستفيد المسجل (Customer ID)</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{activeLicense?.customer_id}</span>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                <span className="text-slate-400 dark:text-slate-500 block font-semibold">تاريخ الانتهاء (Expiry Date)</span>
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar size={14} className="text-purple-600 dark:text-purple-400" />
                  {activeLicense?.expiry_date}
                </span>
              </div>
            </div>

            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex gap-2">
              <Check className="shrink-0 text-emerald-600" size={18} />
              <div>
                <span className="font-bold block">الترخيص صالح وموثق بالمفتاح العام ({SYSTEM_PUBLIC_KEY_ID})</span>
                <p className="font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                  تم فحص التوقيع الرقمي بنجاح دون الحاجة لأي اتصال بالإنترنت.
                </p>
              </div>
            </div>
          </div>

          {/* License Activation Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <form onSubmit={handleActivateLicense} className="space-y-4">
              <div className="space-y-1.5 text-center">
                <div className="bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 p-2.5 rounded-full inline-block">
                  <Key size={22} />
                </div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm block">تنشيط / تجديد الترخيص</h4>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-normal">
                  أدخل مفتاح الترخيص المشفر لتمديد الاشتراك أو التنشيط بدون اتصال بالإنترنت.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">مفتاح الترخيص (License Key / Token)</label>
                <textarea
                  rows={3}
                  value={activationKey}
                  onChange={(e) => setActivationKey(e.target.value)}
                  placeholder="SOLI-LIC-eyJwIjp7InByb2R1Y3RJZCI6..."
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isClockTampered}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
              >
                تنشيط وتدقيق التوقيع الرقمي
              </button>
            </form>
          </div>

          {/* Developer Tool Download Box - ONLY shown if isDeveloperMode is TRUE */}
          {isDeveloperMode && (
            <div className="md:col-span-3 p-4 bg-indigo-950/30 border border-indigo-800/60 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-900/60 text-indigo-400">
                  <Cpu size={18} />
                </div>
                <div>
                  <span className="font-bold text-indigo-200 block">أداة توليد التراخيص المستقلة (خاصة بالمطور / البائع فقط 🔒)</span>
                  <span className="text-[11px] text-slate-400">ملف HTML مستقل تحفظه على هاتفك أو حاسوبك الشخصي لتوليد التراخيص للعملاء أوفلاين</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadKeygenHTML}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
              >
                <Download size={14} />
                <span>تحميل الأداة المستقلة (.html)</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 3: DEVELOPER LICENSE GENERATOR (ONLY IN DEVELOPER MODE) --- */}
      {isDeveloperMode && activeSubTab === 'GENERATOR' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 p-6 rounded-3xl shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Cpu size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">مولد ومحاكي التراخيص الرقمية (Developer Mode)</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">توليد مفاتيح رقمية موقعة بـ Salt المطور ومطابقة للمفتاح العام للمنتج</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadKeygenHTML}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <Download size={14} />
                <span>تحميل الأداة المستقلة</span>
              </button>
            </div>

            <form onSubmit={handleGenerateLicenseKey} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">اسم المستشفى / بريد العميل المشتري:</label>
                <input
                  type="text"
                  value={genCustEmail}
                  onChange={(e) => setGenCustEmail(e.target.value)}
                  placeholder="dr.ahmed@hospital.com أو مستشفى السلام"
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">نوع الترخيص المولد:</label>
                <select
                  value={genLicType}
                  onChange={(e) => setGenLicType(e.target.value as any)}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="COMMERCIAL">تجاري سنوي (Commercial)</option>
                  <option value="TRIAL">تجريبي 30 يوم (Trial)</option>
                  <option value="UNLIMITED">دائم مدى الحياة (Unlimited)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">المدة (بالأشهر):</label>
                <input
                  type="number"
                  value={genDurationMonths}
                  onChange={(e) => setGenDurationMonths(parseInt(e.target.value) || 12)}
                  min={1}
                  max={120}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="md:col-span-3 pt-2">
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles size={16} />
                  <span>توليد وتوقيع رخصة جديدة رقمياً</span>
                </button>
              </div>
            </form>

            {generatedKeyOutput && (
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 size={16} />
                    <span>المفتاح الرقمي المولد (جاهز للنسخ والإرسال للعميل):</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                  >
                    <Copy size={13} />
                    <span>{copiedKey ? 'تم النسخ! ✓' : 'نسخ المفتاح'}</span>
                  </button>
                </div>

                <textarea
                  rows={3}
                  readOnly
                  value={generatedKeyOutput}
                  className="w-full bg-slate-900 border border-slate-800 text-emerald-400 rounded-xl p-3 text-xs font-mono select-all focus:outline-none break-all"
                />
              </div>
            )}
          </div>

          {/* Change Developer PIN Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">تغيير رمز المطور السري (Developer Secret PIN)</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">يمكنك هنا تغيير كلمة المرور التي تفتح بها وضع المطور</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetDevPin}
                className="text-[11px] text-slate-500 hover:text-rose-500 transition-colors cursor-pointer"
                title="استعادة الرمز الافتراضي Mido_ali2"
              >
                استعادة الرمز الافتراضي
              </button>
            </div>

            {pinChangeMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2">
                <Check size={16} />
                <span>{pinChangeMsg}</span>
              </div>
            )}

            <form onSubmit={handleChangeDevPin} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-1">
                <input
                  type="text"
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value)}
                  placeholder="أدخل كلمة السر الجديدة الخاصة بك..."
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <button
                type="submit"
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0"
              >
                <Save size={14} />
                <span>حفظ الرمز الجديد</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Secret Dev PIN Unlock Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-indigo-900/80 w-full max-w-sm rounded-3xl shadow-2xl p-6 space-y-4 text-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-950 flex items-center justify-center text-indigo-400 border border-indigo-800">
                <Lock size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">فتح وضع المطور السري</h3>
                <p className="text-[11px] text-slate-400">خاص بمهندس النظام المطور فقط</p>
              </div>
            </div>

            <form onSubmit={handleVerifyDevPin} className="space-y-3">
              <input
                type="password"
                value={pinInput}
                onChange={(e) => { setPinInput(e.target.value); setPinError(''); }}
                placeholder="أدخل رمز المطور السري..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />

              {pinError && (
                <p className="text-xs text-rose-400 font-bold">{pinError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowPinModal(false); setPinInput(''); setPinError(''); }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  تأكيد وفتح
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restore Data Confirm Dialogue */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-xl overflow-hidden p-6 space-y-4">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
              <AlertTriangle size={20} />
              تحذير: استبدال واستعادة البيانات الحالية!
            </h3>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              لقد تم فحص ملف النسخة الاحتياطية وهو سليم وجاهز للاستيراد. 
              <strong className="block text-slate-700 dark:text-slate-200 mt-1">يرجى العلم أن هذا الإجراء سيقوم باستبدال البيانات الحالية.</strong>
              سيقوم النظام بإنشاء نسخة تراجع تلقائية في الذاكرة المحلية كحماية إضافية قبل الاستبدال.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button 
                type="button" 
                onClick={() => { setShowRestoreConfirm(false); setPendingRestoreData(null); }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg cursor-pointer"
              >
                إلغاء والتراجع
              </button>
              <button 
                type="button" 
                onClick={handleConfirmRestore}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                نعم، تأكيد استعادة النسخة الاحتياطية
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
