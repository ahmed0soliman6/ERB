import React, { useState } from 'react';
import { 
  Download, Upload, ShieldAlert, Check, AlertTriangle, Key, Calendar, 
  ShieldCheck, Database, RefreshCw, Copy, CheckCircle2, Lock, Usb, Cpu, Sparkles
} from 'lucide-react';
import { DBSchema, saveDB, loadDB, verifyLicenseKey, generateSignedLicense, SignedLicensePayload } from '../data/db';
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

      setSuccessMsg(`تم تصدير وحفظ ملف النسخة الاحتياطية (${filename}) بنجاح! الملف جاهز للحفظ على وحدة التخزين.`);
    } catch {
      setErrorMsg('حدث خطأ أثناء تصدير النسخة الاحتياطية.');
    }
  };

  // Helper: Handle file select for restore
  const handleImportBackupSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    setSuccessMsg('');
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        
        // Structure validation
        if (!parsed.users || !parsed.warehouses || !parsed.items || !parsed.movements || !parsed.documents) {
          setErrorMsg('خطأ: بنية الملف تالفة أو لا تطابق قاعدة بيانات نظام SoliMedical-ERB المعتمدة.');
          return;
        }

        setPendingRestoreData(parsed);
        setShowRestoreConfirm(true); // Open dialogue for user verification
      } catch {
        setErrorMsg('خطأ: فشل قراءة الملف. يرجى التأكد من اختيار ملف JSON صحيح.');
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = () => {
    if (!pendingRestoreData) return;

    try {
      // Create auto current state backup first before replacing
      const currentState = loadDB();
      localStorage.setItem('solimedical_erb_auto_backup', JSON.stringify(currentState));

      // Overwrite DB
      saveDB(pendingRestoreData);
      setSuccessMsg('تمت استعادة قاعدة البيانات بنجاح! تم التحقق من سلامة الجداول وإعادة بناء الأرصدة.');
      setShowRestoreConfirm(false);
      setPendingRestoreData(null);
      
      // Force reload state
      onRefresh();
    } catch {
      setErrorMsg('فشلت عملية استعادة البيانات.');
      setShowRestoreConfirm(false);
    }
  };

  // Activate license with cryptographic verification
  const handleActivateLicense = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const res = verifyLicenseKey(activationKey);
    if (res.isValid && res.payload) {
      const freshDb = db;
      
      const newRec = {
        id: freshDb.license_records.length + 1,
        license_id: res.payload.license_id,
        customer_id: res.payload.customer_id,
        license_type: res.payload.license_type,
        issue_date: res.payload.issue_date,
        expiry_date: res.payload.expiry_date,
        raw_payload: res.payload.raw_payload,
        status: 'ACTIVE' as const,
        activated_at: new Date().toISOString()
      };

      freshDb.license_records.push(newRec);
      freshDb.license_state = {
        ...freshDb.license_state,
        last_license_id: res.payload.license_id,
        updated_at: new Date().toISOString()
      };

      // Write to Audit
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

  // Generate signed license using Issuer engine
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
            <Lock className="text-teal-600" size={22} />
            أمن النظام، الترخيص الرقمي، والنسخ الاحتياطي
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs">
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
        <button
          onClick={() => setActiveSubTab('GENERATOR')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'GENERATOR' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          مولد ومحاكي التراخيص (Issuer Tool)
        </button>
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
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => handleExportBackup(false)}
                disabled={isClockTampered}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                <Download size={15} />
                تصدير ملف النظام
              </button>

              <button
                onClick={() => handleExportBackup(true)}
                disabled={isClockTampered}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                <Usb size={15} />
                حفظ لوحدة USB
              </button>
            </div>
          </div>

          {/* Upload Restore Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 p-3 rounded-xl inline-block">
                <RefreshCw size={24} />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">استعادة قاعدة البيانات (Restore)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                استعادة النظام من نسخة احتياطية سابقة. سيقوم النظام بالتحقق التلقائي من سلامة الجداول وعدد الأصناف قبل التطبيق. تنبيه: هذا الإجراء يتطلب تأكيداً مسبقاً لحماية البيانات.
              </p>

              <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <ShieldCheck size={16} className="shrink-0 text-amber-600" />
                <span>يتم إنشاء نسخة تراجع تلقائية قبل الاستعادة لتفادي فقدان أي سجلات.</span>
              </div>
            </div>

            <div className="relative pt-2">
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackupSelect}
                disabled={isClockTampered || user.role !== 'ADMIN'}
                className="hidden"
                id="restore-file-input"
              />
              <label
                htmlFor="restore-file-input"
                className={`w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  (isClockTampered || user.role !== 'ADMIN') ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Upload size={16} />
                اختيار ملف النسخة الاحتياطية (.json)
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
        </div>
      )}

      {/* --- TAB 3: ISSUER GENERATOR (مولد التراخيص) --- */}
      {activeSubTab === 'GENERATOR' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Cpu className="text-indigo-600" size={20} />
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                محاكي جهة إصدار التراخيص المشفرة (Vendor Issuer Engine)
              </h3>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              تتيح هذه الأداة توليد مفاتيح وتوكينات مشفرة وموقعة رقمياً لاختبار التفعيل والاشتراكات السنوية وغير المحدودة بدون إنترنت.
            </p>

            <form onSubmit={handleGenerateLicenseKey} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-300 block">بريد / معرف العميل</label>
                <input
                  type="email"
                  value={genCustEmail}
                  onChange={(e) => setGenCustEmail(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-300 block">نوع الترخيص</label>
                  <select
                    value={genLicType}
                    onChange={(e) => setGenLicType(e.target.value as any)}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 text-xs"
                  >
                    <option value="COMMERCIAL">تجاري (Commercial Subscription)</option>
                    <option value="TRIAL">تجريبي (Trial 30 Days)</option>
                    <option value="UNLIMITED">غير محدود مدى الحياة (Unlimited Lifetime)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-300 block">مدة الاشتراك (بالشهور)</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    disabled={genLicType === 'UNLIMITED'}
                    value={genDurationMonths}
                    onChange={(e) => setGenDurationMonths(Number(e.target.value))}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 text-xs font-mono disabled:opacity-50"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Sparkles size={16} />
                توليد وتوقيع رخصة جديدة رقمياً
              </button>
            </form>
          </div>

          {/* Output generated token */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">رمز الترخيص المولد والموقع (Signed Token):</h4>
              {generatedKeyOutput ? (
                <div className="relative">
                  <textarea
                    readOnly
                    rows={6}
                    value={generatedKeyOutput}
                    className="w-full border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/30 text-indigo-950 dark:text-indigo-200 p-3 rounded-xl font-mono text-[11px] leading-relaxed break-all focus:outline-none"
                  />
                  <button
                    onClick={handleCopyKey}
                    className="absolute top-2 left-2 bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    {copiedKey ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                    {copiedKey ? 'تم النسخ!' : 'نسخ المفتاح'}
                  </button>
                </div>
              ) : (
                <div className="p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center text-slate-400 text-xs">
                  اضغط على زر "توليد وتوقيع رخصة جديدة" لإنشاء توكين ترخيص مشفر واختباره.
                </div>
              )}
            </div>

            {generatedKeyOutput && (
              <button
                onClick={() => {
                  setActivationKey(generatedKeyOutput);
                  setActiveSubTab('LICENSE');
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 rounded-xl transition-all shadow-sm cursor-pointer"
              >
                تطبيق هذا المفتاح في شاشة التنشيط مباشرة ➔
              </button>
            )}
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
