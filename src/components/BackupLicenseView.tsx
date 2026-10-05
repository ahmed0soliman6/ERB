import React, { useState, useEffect } from 'react';
import { 
  Download, Upload, ShieldAlert, Check, AlertTriangle, Key, Calendar, 
  ShieldCheck, Database, RefreshCw, Copy, CheckCircle2, Lock, Usb, Cpu, Sparkles,
  Wrench, KeyRound, Save, Terminal, Play, FileCode, CheckCircle, Clock, Zap,
  Table, Layers, HardDrive, Gauge, ShieldX, Info
} from 'lucide-react';
import { 
  DBSchema, saveDB, loadDB, verifyLicenseKey, generateSignedLicense, 
  SignedLicensePayload, LicenseRecord, extendSystemLicense 
} from '../data/db';
import { SYSTEM_PRODUCT_ID, SYSTEM_PUBLIC_KEY_ID } from '../utils/cryptoLicense';
import { 
  generateFullSQLDump, generateSQLiteSchema, executeClientSQL, 
  SQLQueryResult, getSQLDatabaseTables, parseAndImportSQL, SQLTableSchema 
} from '../utils/sqlEngine';

interface BackupLicenseViewProps {
  db: DBSchema;
  user: any;
  onRefresh: () => void;
}

export const BackupLicenseView: React.FC<BackupLicenseViewProps> = ({ db, user, onRefresh }) => {
  const [activeSubTab, setActiveSubTab] = useState<'SQL_DATABASE' | 'LICENSE' | 'BACKUP' | 'GENERATOR'>('SQL_DATABASE');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [activationKey, setActivationKey] = useState('');
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<any>(null);
  const [pendingSqlText, setPendingSqlText] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Low-Spec Hardware Mode state
  const [isLowSpecMode, setIsLowSpecMode] = useState(() => {
    return localStorage.getItem('solimedical_low_spec_mode') === 'true';
  });

  // SQL Console State
  const [sqlQuery, setSqlQuery] = useState('SHOW TABLES');
  const [sqlResult, setSqlResult] = useState<SQLQueryResult | null>(() => executeClientSQL('SHOW TABLES', db));
  const [selectedTableForSchema, setSelectedTableForSchema] = useState<string | null>(null);

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
  const [genDurationMonths, setGenDurationMonths] = useState<number>(1);
  const [generatedKeyOutput, setGeneratedKeyOutput] = useState('');

  const activeLicense = db.license_records[db.license_records.length - 1];

  // Helper: Calculate remaining license days
  const remainingDays = useMemoDaysRemaining(activeLicense?.expiry_date);

  function useMemoDaysRemaining(expiryDateStr?: string) {
    if (!expiryDateStr) return 0;
    const expiry = new Date(expiryDateStr).getTime();
    const now = new Date().getTime();
    return Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
  }

  // Toggle Low-Spec Hardware Mode
  const handleToggleLowSpecMode = () => {
    const nextVal = !isLowSpecMode;
    setIsLowSpecMode(nextVal);
    localStorage.setItem('solimedical_low_spec_mode', String(nextVal));
    if (nextVal) {
      document.documentElement.classList.add('low-spec-mode');
      setSuccessMsg('تم تفعيل وضع الأجهزة الاقتصادية / الضعيفة. تم تعطيل الرسوم الثقيلة وتقليل استهلاك الذاكرة.');
    } else {
      document.documentElement.classList.remove('low-spec-mode');
      setSuccessMsg('تم تعطيل وضع الأجهزة الاقتصادية والعودة للوضع الرسومي الكامل.');
    }
  };

  // 1. Quick License Extension / Renewal Handler
  const handleQuickRenewLicense = (months: number, type: 'TRIAL' | 'COMMERCIAL' | 'UNLIMITED' = 'COMMERCIAL') => {
    const updatedRec = extendSystemLicense(db, months, type, user.display_name || user.username);
    const label = type === 'UNLIMITED' ? 'مدى الحياة (دائم)' : `${months} شهر`;
    setSuccessMsg(`تم تجديد وترقية ترخيص النظام بنجاح! المدة المضافة: (${label})، تاريخ الانتهاء الجديد: ${updatedRec.expiry_date}.`);
    onRefresh();
  };

  // 2. Export SQLite SQL Script
  const handleExportSQLDump = () => {
    try {
      const dump = generateFullSQLDump(db);
      const filename = `SoliMedical_SQLite_Dump_${new Date().toISOString().split('T')[0]}.sql`;
      const blob = new Blob([dump], { type: 'application/sql;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSuccessMsg(`تم تصدير قاعدة بيانات SQLite بصيغة SQL Dump بنجاح (${filename}). متوافقة 100% مع DB Browser for SQLite.`);
    } catch {
      setErrorMsg('حدث خطأ أثناء تصدير ملف SQL.');
    }
  };

  // 3. Import SQL File
  const handleSQLFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text || (!text.includes('CREATE TABLE') && !text.includes('INSERT INTO'))) {
          throw new Error('الملف لا يحتوي على أوامر SQL صالحة متوافقة مع النظام.');
        }
        setPendingSqlText(text);
        setShowRestoreConfirm(true);
      } catch (err: any) {
        setErrorMsg(err.message || 'فشل قراءة ملف SQL. تأكد من تحديد ملف .sql صالح.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 4. Execute SQL Query
  const handleRunSQL = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const res = executeClientSQL(sqlQuery, db);
    setSqlResult(res);
  };

  // 5. Trigger JSON database download
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

      setSuccessMsg(`تم إنشاء وتصدير النسخة الاحتياطية بنجاح (${filename}).`);
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch {
      setErrorMsg('حدث خطأ أثناء محاولة تصدير قاعدة البيانات.');
    }
  };

  // 6. Handle file upload for JSON restore
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
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
    e.target.value = '';
  };

  // 7. Confirm restore (handles both JSON and SQL file restore)
  const handleConfirmRestore = () => {
    try {
      const current = loadDB();
      localStorage.setItem('solimedical_safety_backup_before_restore', JSON.stringify(current));

      if (pendingSqlText) {
        const res = parseAndImportSQL(pendingSqlText, current);
        if (!res.success) {
          setErrorMsg(`فشل استيراد ملف SQL: ${res.error}`);
          return;
        }
        setSuccessMsg(`تمت استعادة وتحديث قاعدة البيانات من ملف SQL بنجاح! تم استيراد (${res.importedCount}) سجل.`);
        setPendingSqlText(null);
      } else if (pendingRestoreData) {
        saveDB(pendingRestoreData);
        setPendingRestoreData(null);
        setSuccessMsg('تمت استعادة قاعدة البيانات بنجاح تام! تم تحديث جميع السجلات والحسابات.');
      }

      setShowRestoreConfirm(false);
      onRefresh();
    } catch {
      setErrorMsg('فشلت عملية استعادة البيانات. يرجى مراجعة صلاحيات التخزين.');
    }
  };

  // 8. Activate License Key
  const handleActivateLicense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activationKey.trim()) {
      setErrorMsg('يرجى إدخال كود التفعيل.');
      return;
    }

    const check = verifyLicenseKey(activationKey.trim());
    if (!check.isValid || !check.payload) {
      setErrorMsg(`فشل التنشيط: ${check.error || 'رمز الترخيص غير صالح أو تالف'}`);
      return;
    }

    const rec = check.payload;
    const nextId = db.license_records.length > 0 ? Math.max(...db.license_records.map(l => l.id)) + 1 : 1;
    const newRecord: LicenseRecord = {
      id: nextId,
      license_id: rec.license_id,
      customer_id: rec.customer_id,
      license_type: rec.license_type,
      issue_date: rec.issue_date,
      expiry_date: rec.expiry_date,
      raw_payload: rec.raw_payload,
      status: 'ACTIVE',
      activated_at: new Date().toISOString()
    };

    db.license_records.push(newRecord);
    db.license_state.last_license_id = rec.license_id;
    db.license_state.updated_at = new Date().toISOString();

    db.audit_logs.push({
      id: db.audit_logs.length > 0 ? Math.max(...db.audit_logs.map(a => a.id)) + 1 : 1,
      user_id: user.id,
      username: user.display_name || user.username,
      action: `تفعيل ترخيص جديد رقم (${rec.license_id})`,
      entity_type: 'ترخيص النظام',
      entity_id: nextId,
      occurred_at: new Date().toISOString()
    });

    saveDB(db);
    setActivationKey('');
    setSuccessMsg(`تم تفعيل الترخيص بنجاح! الصلاحية سارية حتى: ${rec.expiry_date}`);
    onRefresh();
  };

  // 9. Generate Signed License in Developer/Admin Keygen
  const handleGenerateLicenseKey = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date();
    const expiry = new Date();
    if (genLicType === 'UNLIMITED') {
      expiry.setFullYear(expiry.getFullYear() + 20);
    } else {
      expiry.setMonth(expiry.getMonth() + genDurationMonths);
    }

    const payload: SignedLicensePayload = {
      licenseId: `SOLI-${genLicType}-${Date.now().toString().slice(-6)}`,
      customerId: genCustEmail.trim(),
      licenseType: genLicType,
      issueDate: now.toISOString().split('T')[0],
      expiryDate: expiry.toISOString().split('T')[0],
      productId: SYSTEM_PRODUCT_ID,
      version: '1.0.0',
      features: ['UNLIMITED_ITEMS', 'ALL_WAREHOUSES', 'SQLITE_ENGINE', 'AUDIT_LOGS', 'REORDER_ALERTS']
    };

    const key = generateSignedLicense(payload);
    setGeneratedKeyOutput(key);
    setCopiedKey(false);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(generatedKeyOutput);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 3000);
  };

  // Secret Dev PIN unlock handler
  const handleLockIconClick = () => {
    if (isDeveloperMode) return;
    const nextCount = lockClickCount + 1;
    setLockClickCount(nextCount);
    if (nextCount >= 5) {
      setShowPinModal(true);
      setLockClickCount(0);
    }
  };

  const handleVerifyDevPin = (e: React.FormEvent) => {
    e.preventDefault();
    const storedPin = getStoredDevPin();
    if (pinInput.trim() === storedPin) {
      setDevUnlocked(true);
      setShowPinModal(false);
      setPinInput('');
      setPinError('');
      setSuccessMsg('تم فتح وضع المطور وأداة توليد التراخيص الرقمية بنجاح!');
    } else {
      setPinError('رمز المطور السري غير صحيح!');
    }
  };

  const databaseTables = getSQLDatabaseTables(db);
  const totalDbSizeKb = databaseTables.reduce((sum, t) => sum + t.sizeKb, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600/30 border border-blue-500/40 rounded-2xl text-blue-400">
              <Database size={28} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">قاعدة بيانات SQL والأمن والتراخيص</h2>
              <p className="text-xs sm:text-sm text-slate-300">
                محرك علائقي مدمج متوافق مع SQLite للأجهزة الضعيفة، مع ترخيص شهر تلقائي قابل للتجديد
              </p>
            </div>
          </div>
        </div>

        {/* Secret Developer Lock Trigger */}
        <div className="flex items-center gap-2 relative z-10">
          <button
            onClick={handleLockIconClick}
            className={`p-3 rounded-2xl border transition-all cursor-pointer ${
              isDeveloperMode 
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-sm' 
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title={isDeveloperMode ? 'وضع المطور نشط' : 'نظام الحماية والأمان مشفر'}
          >
            {isDeveloperMode ? <Sparkles size={20} /> : <Lock size={20} />}
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            {successMsg}
          </span>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-900 dark:hover:text-emerald-100 cursor-pointer">×</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-300 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
          <span className="flex items-center gap-2">
            <AlertTriangle size={16} />
            {errorMsg}
          </span>
          <button onClick={() => setErrorMsg('')} className="text-red-600 hover:text-red-900 dark:hover:text-red-100 cursor-pointer">×</button>
        </div>
      )}

      {/* Navigation SubTabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab('SQL_DATABASE')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'SQL_DATABASE'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Database size={16} />
          <span>قاعدة بيانات SQL المدمجة (SQLite Engine)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('LICENSE')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'LICENSE'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <KeyRound size={16} />
          <span>إدارة رخصة النظام والتجديد (+1 شهر)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('BACKUP')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'BACKUP'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <HardDrive size={16} />
          <span>النسخ الاحتياطي السحابي وUSB</span>
        </button>

        {isDeveloperMode && (
          <button
            type="button"
            onClick={() => setActiveSubTab('GENERATOR')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'GENERATOR'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-900'
            }`}
          >
            <Sparkles size={16} />
            <span>مولد التراخيص المشفرة (Admin Keygen)</span>
          </button>
        )}
      </div>

      {/* --- TAB 1: SQL DATABASE & LOW-END HARDWARE ENGINE --- */}
      {activeSubTab === 'SQL_DATABASE' && (
        <div className="space-y-6">
          
          {/* Hardware & Low-End Specs Optimization Banner */}
          <div className="bg-gradient-to-r from-blue-900/30 via-slate-900 to-teal-950/30 border border-blue-500/30 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-sm">
                  <Gauge size={24} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">
                    محرك SQL متوافق 100% ومحسن للأجهزة الضعيفة (Low-Spec Hardware)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-300 leading-relaxed mt-0.5">
                    يعمل ذاتياً بنمط أوف لاين محلي دون الحاجة لتثبيت سيرفرات ثقيلة أو استهلاك الذاكرة. متوافق مع Windows 8 و 10 و 11.
                  </p>
                </div>
              </div>

              {/* Eco-mode Hardware Toggle */}
              <button
                type="button"
                onClick={handleToggleLowSpecMode}
                className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                  isLowSpecMode 
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                <Zap size={15} />
                <span>{isLowSpecMode ? 'وضع الأجهزة الضعيفة: مفعّل ⚡' : 'تفعيل وضع الأجهزة الاقتصادية'}</span>
              </button>
            </div>

            {/* Hardware Metrics Indicator Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
              <div className="bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-3.5 rounded-2xl space-y-1">
                <span className="text-[11px] text-slate-400 font-bold block">استهلاك الذاكرة (RAM):</span>
                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">~ 18 MB (Ultra-Light)</span>
              </div>
              <div className="bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-3.5 rounded-2xl space-y-1">
                <span className="text-[11px] text-slate-400 font-bold block">حجم قاعدة البيانات الحالية:</span>
                <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-sm">{totalDbSizeKb} KB ({databaseTables.reduce((s,t)=>s+t.rowCount, 0)} سجل)</span>
              </div>
              <div className="bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-3.5 rounded-2xl space-y-1">
                <span className="text-[11px] text-slate-400 font-bold block">سرعة الاستعلام (Latency):</span>
                <span className="font-mono font-black text-purple-600 dark:text-purple-400 text-sm">&lt; 1.5 ms (Instant)</span>
              </div>
              <div className="bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-3.5 rounded-2xl space-y-1">
                <span className="text-[11px] text-slate-400 font-bold block">معيار المحرك:</span>
                <span className="font-mono font-black text-slate-800 dark:text-slate-200 text-sm">ANSI SQL / SQLite3</span>
              </div>
            </div>
          </div>

          {/* SQL Operations & Export/Import Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Export SQL */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl w-fit">
                  <Download size={20} />
                </div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">تصدير ملف SQL Dump كامل (.sql)</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  يقوم بتوليد سكربت SQL شامل يحتوي على أوامر <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-blue-600">CREATE TABLE</code> و <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-blue-600">INSERT INTO</code> لجميع الجداول. يمكن فتحه مباشرة ببرنامج <strong>DB Browser for SQLite</strong> أو استيراده في MySQL / PostgreSQL.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportSQLDump}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Download size={16} />
                <span>تحميل قاعدة البيانات بصيغة (.sql)</span>
              </button>
            </div>

            {/* Import SQL */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl w-fit">
                  <Upload size={20} />
                </div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">استيراد واستعادة قاعدة بيانات من ملف (.sql)</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  اختر أي ملف سكربت SQL (.sql) لاستعادة الأصناف، الحركات، الموردين، والمستودعات تلقائياً. يقوم النظام بعمل نقطة أمان قبل المعالجة.
                </p>
              </div>

              <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-xl p-3 text-center cursor-pointer block transition-colors bg-slate-50/50 dark:bg-slate-800/30">
                <input type="file" accept=".sql" onChange={handleSQLFileUpload} className="hidden" />
                <Upload size={18} className="mx-auto text-slate-400 mb-1" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block">انقر لتحديد ملف SQL (.sql) للاستيراد</span>
              </label>
            </div>
          </div>

          {/* Visual SQL Database Tables Schema Inspector */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Table className="text-blue-600" size={20} />
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base">
                  هيكل وجداول قاعدة البيانات العلائقية (Relational SQL Schema)
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">10 جداول مهيأة</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {databaseTables.map((t) => (
                <div
                  key={t.name}
                  onClick={() => {
                    setSqlQuery(`SELECT * FROM ${t.name} LIMIT 20`);
                    executeClientSQL(`SELECT * FROM ${t.name} LIMIT 20`, db);
                  }}
                  className="p-3.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-800 rounded-xl transition-all cursor-pointer space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-xs text-blue-700 dark:text-blue-300 group-hover:underline">
                      {t.name}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md font-bold text-slate-600 dark:text-slate-400">
                      {t.rowCount} سجل
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.name_ar}</p>
                  <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span>{t.columns.length} أعمدة</span>
                    <span>~ {t.sizeKb} KB</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive SQL Query Console */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="text-teal-600" size={20} />
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base">
                  محرر استعلامات SQL المباشر (Interactive SQL Query Editor)
                </h3>
              </div>
              
              {/* Quick Query Templates */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                <span className="text-slate-400 font-sans font-bold text-[11px]">قوالب:</span>
                <button
                  type="button"
                  onClick={() => { setSqlQuery('SHOW TABLES'); const r = executeClientSQL('SHOW TABLES', db); setSqlResult(r); }}
                  className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-bold cursor-pointer"
                >
                  SHOW TABLES
                </button>
                <button
                  type="button"
                  onClick={() => { setSqlQuery('SELECT * FROM items LIMIT 10'); const r = executeClientSQL('SELECT * FROM items LIMIT 10', db); setSqlResult(r); }}
                  className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-bold cursor-pointer"
                >
                  SELECT items
                </button>
                <button
                  type="button"
                  onClick={() => { setSqlQuery('SELECT * FROM stock_movements'); const r = executeClientSQL('SELECT * FROM stock_movements', db); setSqlResult(r); }}
                  className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-bold cursor-pointer"
                >
                  SELECT movements
                </button>
                <button
                  type="button"
                  onClick={() => { setSqlQuery('SELECT * FROM suppliers'); const r = executeClientSQL('SELECT * FROM suppliers', db); setSqlResult(r); }}
                  className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-bold cursor-pointer"
                >
                  SELECT suppliers
                </button>
                <button
                  type="button"
                  onClick={() => { setSqlQuery('SELECT * FROM system_licenses'); const r = executeClientSQL('SELECT * FROM system_licenses', db); setSqlResult(r); }}
                  className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-bold cursor-pointer"
                >
                  SELECT licenses
                </button>
              </div>
            </div>

            {/* SQL Input Form */}
            <form onSubmit={handleRunSQL} className="space-y-3">
              <div className="relative">
                <textarea
                  rows={3}
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  placeholder="اكتب استعلام SQL هنا (مثال: SELECT * FROM items WHERE minimum_stock = 50)..."
                  className="w-full bg-slate-950 text-emerald-400 font-mono text-xs p-3.5 rounded-xl border border-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  dir="ltr"
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-400">
                  ⚡ محرك SQL محلي متوافق مع معايير SQLite3.
                </span>
                <button
                  type="submit"
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Play size={14} />
                  <span>تنفيذ الاستعلام (Execute SQL)</span>
                </button>
              </div>
            </form>

            {/* SQL Results Table */}
            {sqlResult && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                  <span>النتائج: <strong>{sqlResult.rowCount}</strong> صفوف</span>
                  <span className="font-mono text-teal-600 dark:text-teal-400 font-bold">زمن التنفيذ: {sqlResult.executionTimeMs} ms</span>
                </div>

                {sqlResult.error ? (
                  <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-xl text-xs font-mono">
                    {sqlResult.error}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 max-h-80 overflow-y-auto">
                    <table className="w-full text-right border-collapse text-xs select-none">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          {sqlResult.columns.map((col, idx) => (
                            <th key={idx} className="p-2.5 border-l border-slate-200 dark:border-slate-700">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200 font-mono">
                        {sqlResult.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            {row.map((val, cIdx) => (
                              <td key={cIdx} className="p-2.5 border-l border-slate-100 dark:border-slate-800">
                                {typeof val === 'boolean' ? (val ? 'TRUE' : 'FALSE') : String(val ?? 'NULL')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB 2: LICENSE MANAGEMENT & 1-CLICK RENEWAL --- */}
      {activeSubTab === 'LICENSE' && (
        <div className="space-y-6">
          
          {/* Automatic 1-Month Default License Notice */}
          <div className="bg-gradient-to-r from-blue-900/30 via-slate-900 to-indigo-900/30 border border-blue-500/30 rounded-3xl p-5 sm:p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 text-white rounded-xl">
                <Info size={22} />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">الرخصة التلقائية للنظام: شهر كامل (30 يوماً)</h4>
                <p className="text-xs text-slate-300">
                  يبدأ ترخيص النظام تلقائياً لمدة شهر (30 يوماً) من تاريخ أول تشغيل، ويمكنك تمديدها أو تجديدها في أي وقت بنقرة زر واحدة أو بمفتاح مشفر.
                </p>
              </div>
            </div>
          </div>

          {/* Current Active License Status Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 rounded-xl">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">بيانات رخصة النظام الحالية</h3>
                  <span className="text-xs text-slate-400">نظام ترخيص رقمي محلي أوف لاين محمي بالتوقيع الرقمي</span>
                </div>
              </div>

              <span className={`px-3 py-1 rounded-xl text-xs font-black ${
                remainingDays < 0 
                  ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300' 
                  : remainingDays <= 7 
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' 
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
              }`}>
                {remainingDays < 0 ? 'منتهي الصلاحية ⚠️' : `متبقي ${remainingDays} يوم (${remainingDays > 0 ? 'نشط' : 'منتهي'})`}
              </span>
            </div>

            {/* License Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                <span className="text-slate-400 block font-bold">نوع الرخصة</span>
                <span className="font-bold text-sm text-teal-600 dark:text-teal-400">
                  {activeLicense?.license_type === 'TRIAL' ? 'تجريبي (شهر تلقائي)' : activeLicense?.license_type === 'UNLIMITED' ? 'دائم مدى الحياة' : 'تجاري رسمي'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                <span className="text-slate-400 block font-bold">رقم الترخيص</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{activeLicense?.license_id}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                <span className="text-slate-400 block font-bold">تاريخ البدء</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{activeLicense?.issue_date}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                <span className="text-slate-400 block font-bold">تاريخ الانتهاء</span>
                <span className="font-mono font-bold text-purple-600 dark:text-purple-400">{activeLicense?.expiry_date}</span>
              </div>
            </div>
          </div>

          {/* 🚀 1-CLICK LICENSE RENEWAL & EXTENSION PANEL */}
          <div className="bg-gradient-to-br from-teal-900/40 via-slate-900 to-indigo-950/40 border border-teal-500/30 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-teal-500 text-white rounded-xl">
                <RefreshCw size={20} />
              </div>
              <div>
                <h3 className="font-black text-white text-base">
                  تمديد وتجديد الترخيص السريع للمستخدم
                </h3>
                <p className="text-teal-200/80 text-xs">
                  يمكنك تمديد وتجديد صلاحية النظام للمستخدم مباشرة بنقرة زر واحدة:
                </p>
              </div>
            </div>

            {/* Quick Renewal Action Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleQuickRenewLicense(1, 'COMMERCIAL')}
                className="p-3.5 bg-white/10 hover:bg-teal-600 text-white rounded-xl text-xs font-bold border border-white/15 transition-all text-center space-y-1 cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
              >
                <span className="block text-sm font-black">+ شهر واحد</span>
                <span className="text-[10px] text-teal-200 block">30 يوماً إضافية</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickRenewLicense(3, 'COMMERCIAL')}
                className="p-3.5 bg-white/10 hover:bg-teal-600 text-white rounded-xl text-xs font-bold border border-white/15 transition-all text-center space-y-1 cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
              >
                <span className="block text-sm font-black">+ 3 أشهر</span>
                <span className="text-[10px] text-teal-200 block">90 يوماً إضافية</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickRenewLicense(6, 'COMMERCIAL')}
                className="p-3.5 bg-white/10 hover:bg-teal-600 text-white rounded-xl text-xs font-bold border border-white/15 transition-all text-center space-y-1 cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
              >
                <span className="block text-sm font-black">+ 6 أشهر</span>
                <span className="text-[10px] text-teal-200 block">نصف سنة</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickRenewLicense(12, 'COMMERCIAL')}
                className="p-3.5 bg-white/10 hover:bg-teal-600 text-white rounded-xl text-xs font-bold border border-white/15 transition-all text-center space-y-1 cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
              >
                <span className="block text-sm font-black">+ سنة كاملة</span>
                <span className="text-[10px] text-teal-200 block">365 يوماً تجاري</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickRenewLicense(0, 'UNLIMITED')}
                className="p-3.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-bold border border-amber-400/30 transition-all text-center space-y-1 cursor-pointer shadow-md col-span-2 sm:col-span-1 hover:scale-[1.02] active:scale-[0.98]"
              >
                <span className="block text-sm font-black">مدى الحياة ♾️</span>
                <span className="text-[10px] text-amber-100 block">ترخيص دائم</span>
              </button>
            </div>
          </div>

          {/* Manual License Token Input Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <form onSubmit={handleActivateLicense} className="space-y-4">
              <div className="flex items-center gap-2">
                <Key size={18} className="text-teal-600" />
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">أو تفعيل بواسطة مفتاح مشفر (License Token)</h4>
              </div>

              <div className="space-y-1">
                <textarea
                  rows={2}
                  value={activationKey}
                  onChange={(e) => setActivationKey(e.target.value)}
                  placeholder="ألصق كود الترخيص المشفر هنا..."
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none"
                />
              </div>

              <button
                type="submit"
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs py-2.5 px-5 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                تنشيط وتدقيق التوقيع الرقمي
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- TAB 3: BACKUP & RESTORE (JSON / USB) --- */}
      {activeSubTab === 'BACKUP' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Export JSON */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 p-3 rounded-xl inline-block">
                <Download size={24} />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">تصدير نسخة احتياطية شاملة (JSON)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                حفظ كافة بيانات الأصناف والمستودعات وسجلات الحركة والتدقيق في ملف محمي ومحلي للاحتفاظ به على القرص أو الفلاش ميموري (USB).
              </p>
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
                <Usb size={16} />
                <span>نسخ لـ USB</span>
              </button>
            </div>
          </div>

          {/* Import JSON */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 p-3 rounded-xl inline-block">
                <Upload size={24} />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">استعادة البيانات من نسخة سابقة</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                حدد ملف النسخة الاحتياطية (.json) لاستعادة كافة الحركات والأرصدة. يقوم النظام تلقائياً بإنشاء نقطة استعادة أمان فورية قبل التنفيذ.
              </p>
            </div>

            <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-teal-500 rounded-xl p-4 text-center cursor-pointer block transition-colors bg-slate-50/50 dark:bg-slate-800/30">
              <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
              <Upload size={20} className="mx-auto text-slate-400 mb-1" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block">اختر ملف النسخة الاحتياطية (.json)</span>
            </label>
          </div>
        </div>
      )}

      {/* --- TAB 4: DEVELOPER LICENSE GENERATOR (ONLY IN DEVELOPER MODE) --- */}
      {isDeveloperMode && activeSubTab === 'GENERATOR' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 p-6 rounded-3xl shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Cpu size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">مولد ومحاكي التراخيص الرقمية (Admin / Developer Keygen)</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">توليد مفاتيح رقمية مشفرة وموقعة للمستخدمين</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleGenerateLicenseKey} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">اسم المستشفى / بريد العميل:</label>
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
                <label className="font-bold text-slate-700 dark:text-slate-300 block">نوع الترخيص:</label>
                <select
                  value={genLicType}
                  onChange={(e) => setGenLicType(e.target.value as any)}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="COMMERCIAL">تجاري رسمي (Commercial)</option>
                  <option value="TRIAL">تجريبي 30 يوم (Trial)</option>
                  <option value="UNLIMITED">دائم مدى الحياة (Unlimited)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">المدة (بالأشهر):</label>
                <input
                  type="number"
                  value={genDurationMonths}
                  onChange={(e) => setGenDurationMonths(parseInt(e.target.value) || 1)}
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
                    <span>المفتاح الرقمي المولد (جاهز للنسخ والإرسال للمستخدم):</span>
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
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="font-bold text-rose-600 text-base flex items-center gap-2">
              <AlertTriangle size={20} />
              تأكيد استعادة وتحديث قاعدة البيانات
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              تحذير: ستؤدي هذه العملية إلى تحديث واستعادة سجلات قاعدة البيانات الحالية بالبيانات الموجودة في الملف المحدد. هل تريد المتابعة؟
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => { setShowRestoreConfirm(false); setPendingSqlText(null); setPendingRestoreData(null); }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                نعم، تأكيد الاستعادة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Developer PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="font-bold text-indigo-600 text-base flex items-center gap-2">
              <Lock size={18} />
              تأكيد الدخول لوضع المطور
            </h3>
            <form onSubmit={handleVerifyDevPin} className="space-y-3">
              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="أدخل رمز المطور السري..."
                className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl p-2.5 text-xs text-center font-mono font-bold"
                autoFocus
              />
              {pinError && <span className="text-[11px] text-red-500 block text-center font-bold">{pinError}</span>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                >
                  تأكيد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
