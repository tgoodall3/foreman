"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useToast } from "@/components/ui/ToastContainer";
import { useLanguage } from "@/lib/i18n";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";

export default function AccountClient({ profile, tenant }: { profile: any; tenant: any }) {
  const supabase = createClient();
  const { addToast } = useToast();
  const { t } = useLanguage();
  const [bizName, setBizName]   = useState(tenant?.name || "");
  const [bizPhone, setBizPhone] = useState(tenant?.phone || "");
  const [bizAddr, setBizAddr]   = useState(tenant?.address || "");
  const [invoiceFooter, setInvoiceFooter] = useState(tenant?.invoice_footer || "");
  const [taxId, setTaxId]       = useState(tenant?.tax_id || "");
  const [website, setWebsite]   = useState(tenant?.website || "");
  const [savingBiz, setSavingBiz] = useState(false);
  const [savedBiz, setSavedBiz] = useState(false);
  const [errorBiz, setErrorBiz] = useState("");

  // Personal account settings
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [savedPersonal, setSavedPersonal] = useState(false);
  const [errorPersonal, setErrorPersonal] = useState("");

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [savedPassword, setSavedPassword] = useState(false);
  const [errorPassword, setErrorPassword] = useState("");

  const handleSaveBiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBiz(true); setErrorBiz(""); setSavedBiz(false);
    const res = await fetch("/api/settings/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: tenant.id, name: bizName, phone: bizPhone, address: bizAddr, invoice_footer: invoiceFooter, tax_id: taxId, website }),
    });
    if (res.ok) { setSavedBiz(true); addToast(t("settings.businessSaved"), "success"); }
    else { setErrorBiz(t("common.failedTryAgain")); addToast(t("common.failedTryAgain"), "error"); }
    setSavingBiz(false);
  };

  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPersonal(true); setErrorPersonal(""); setSavedPersonal(false);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), phone: phone.trim() || null })
      .eq("id", profile.id);
    if (error) { setErrorPersonal(t("common.failedTryAgain")); addToast(t("common.failedTryAgain"), "error"); }
    else { setSavedPersonal(true); addToast(t("settings.personalSaved"), "success"); }
    setSavingPersonal(false);
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setErrorPassword(t("settings.passwordMismatch"));
      return;
    }
    setSavingPassword(true); setErrorPassword(""); setSavedPassword(false);
    const res = await fetch("/api/settings/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (res.ok) {
      setSavedPassword(true);
      addToast(t("settings.passwordChanged"), "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setErrorPassword(data.error || t("settings.passwordChangeFailed"));
      addToast(data.error || t("settings.passwordChangeFailed"), "error");
    }
    setSavingPassword(false);
  };

  const inp = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-amber";

  return (
    <div className="space-y-5 w-full max-w-3xl mx-auto px-2 sm:px-0">
      <div className="flex justify-end">
        <LanguageSwitcher variant="light" />
      </div>
      <form onSubmit={handleSaveBiz} noValidate className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 sm:p-6">
        <h2 className="font-display font-700 text-lg text-forge">{t("settings.businessInfo")}</h2>
        <div>
          <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("settings.businessName")}</label>
          <input value={bizName} onChange={(e) => setBizName(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("settings.phone")}</label>
          <input type="tel" value={bizPhone} onChange={(e) => setBizPhone(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("settings.address")}</label>
          <input value={bizAddr} onChange={(e) => setBizAddr(e.target.value)} className={inp} placeholder="123 Main St, City, State" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("settings.website")}</label>
            <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} className={inp} placeholder="https://yourbusiness.com" />
          </div>
          <div>
            <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("settings.taxId")}</label>
            <input value={taxId} onChange={(e) => setTaxId(e.target.value)} className={inp} placeholder="XX-XXXXXXX" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("settings.invoiceFooter")}</label>
          <textarea
            value={invoiceFooter}
            onChange={(e) => setInvoiceFooter(e.target.value)}
            rows={2}
            maxLength={500}
            className={inp + " resize-none"}
            placeholder={t("settings.invoiceFooterPlaceholder")}
          />
          <p className="text-xs text-mist mt-1">{invoiceFooter.length}/500 — {t("settings.invoiceFooterNote")}</p>
        </div>
        {errorBiz && <p className="text-sm text-red-600">{errorBiz}</p>}
        {savedBiz && <p className="text-sm text-green-600">✓ {t("common.saved")}</p>}
        <button type="submit" disabled={savingBiz} className="bg-forge hover:bg-forge-light disabled:opacity-50 text-white font-display font-700 px-4 py-2 rounded-lg text-sm transition-colors">
          {savingBiz ? t("common.saving") : t("common.save")}
        </button>
      </form>

      <form onSubmit={handleSavePersonal} noValidate className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-display font-700 text-lg text-forge">{t("settings.personalInfo")}</h2>
        <div>
          <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("settings.fullName")}</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("settings.phone")}</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("settings.email")}</label>
          <input type="email" value={profile.email} disabled className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-gray-50" />
        </div>
        {errorPersonal && <p className="text-sm text-red-600">{errorPersonal}</p>}
        {savedPersonal && <p className="text-sm text-green-600">✓ {t("common.saved")}</p>}
        <button type="submit" disabled={savingPersonal} className="bg-forge hover:bg-forge-light disabled:opacity-50 text-white font-display font-700 px-4 py-2 rounded-lg text-sm transition-colors">
          {savingPersonal ? t("common.saving") : t("common.save")}
        </button>
      </form>

      <form onSubmit={handleSavePassword} noValidate className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-display font-700 text-lg text-forge">{t("settings.changePassword")}</h2>
        <div>
          <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("settings.currentPassword")}</label>
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inp} required />
        </div>
        <div>
          <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("settings.newPassword")}</label>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inp} required minLength={8} />
        </div>
        <div>
          <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("settings.confirmPassword")}</label>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inp} required minLength={8} />
        </div>
        {errorPassword && <p className="text-sm text-red-600">{errorPassword}</p>}
        {savedPassword && <p className="text-sm text-green-600">✓ {t("settings.passwordChanged")}</p>}
        <button type="submit" disabled={savingPassword} className="bg-forge hover:bg-forge-light disabled:opacity-50 text-white font-display font-700 px-4 py-2 rounded-lg text-sm transition-colors">
          {savingPassword ? t("settings.changingPassword") : t("settings.changePasswordButton")}
        </button>
      </form>
    </div>
  );
}
