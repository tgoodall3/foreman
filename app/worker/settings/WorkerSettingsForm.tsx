"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useLanguage } from "@/lib/i18n";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
}

interface WorkerSettingsFormProps {
  profile: Profile;
}

export default function WorkerSettingsForm({ profile }: WorkerSettingsFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();
  const [fullName, setFullName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), phone: phone.trim() || null })
      .eq("id", profile.id);

    if (error) {
      setError(t("settings.profileUpdateFailed"));
    } else {
      router.refresh();
    }
    setLoading(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError(t("settings.passwordMismatch"));
      return;
    }
    setChangingPassword(true);
    setPasswordError("");
    setPasswordSuccess(false);

    const res = await fetch("/api/settings/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (res.ok) {
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setPasswordError(data.error || t("settings.passwordChangeFailed"));
    }
    setChangingPassword(false);
  };

  return (
    <>
      <div className="flex justify-end mb-2">
        <LanguageSwitcher variant="light" />
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-display font-700 text-lg text-forge">{t("settings.profileSection")}</h2>
          <div>
            <label htmlFor="email" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("settings.email")}</label>
            <input id="email" type="email" value={profile.email} disabled className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-gray-50" />
            <p className="text-xs text-mist mt-1">{t("settings.emailNote")}</p>
          </div>
          <div>
            <label htmlFor="fullName" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("settings.fullName")}</label>
            <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-amber" />
          </div>
          <div>
            <label htmlFor="phone" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("settings.phone")}</label>
            <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-amber" />
          </div>
        </div>

        {error && <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        <button type="submit" disabled={loading} className="bg-amber hover:bg-amber-dark disabled:opacity-50 text-forge font-display font-700 px-5 py-2.5 rounded-lg text-sm transition-colors">
          {loading ? t("common.saving") : t("common.save")}
        </button>
      </form>

      <form onSubmit={handleChangePassword} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-display font-700 text-lg text-forge">{t("settings.changePassword")}</h2>
          <div>
            <label htmlFor="currentPassword" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("settings.currentPassword")}</label>
            <input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-amber" />
          </div>
          <div>
            <label htmlFor="newPassword" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("settings.newPassword")}</label>
            <input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-amber" />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("settings.confirmPassword")}</label>
            <input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-amber" />
          </div>
        </div>

        {passwordError && <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{passwordError}</div>}
        {passwordSuccess && <div role="alert" className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">✓ {t("settings.passwordChanged")}</div>}

        <button type="submit" disabled={changingPassword} className="bg-amber hover:bg-amber-dark disabled:opacity-50 text-forge font-display font-700 px-5 py-2.5 rounded-lg text-sm transition-colors">
          {changingPassword ? t("settings.changingPassword") : t("settings.changePasswordButton")}
        </button>
      </form>
    </>
  );
}