"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";

export default function AccountClient({ profile, tenant }: { profile: any; tenant: any }) {
  const supabase = createClient();
  const [bizName, setBizName]   = useState(tenant?.name || "");
  const [bizPhone, setBizPhone] = useState(tenant?.phone || "");
  const [bizAddr, setBizAddr]   = useState(tenant?.address || "");
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
      body: JSON.stringify({ tenantId: tenant.id, name: bizName, phone: bizPhone, address: bizAddr }),
    });
    if (res.ok) setSavedBiz(true);
    else setErrorBiz("Failed to save. Try again.");
    setSavingBiz(false);
  };

  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPersonal(true); setErrorPersonal(""); setSavedPersonal(false);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), phone: phone.trim() || null })
      .eq("id", profile.id);
    if (error) setErrorPersonal("Failed to save. Try again.");
    else setSavedPersonal(true);
    setSavingPersonal(false);
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setErrorPassword("New passwords don't match");
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
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setErrorPassword(data.error || "Failed to change password");
    }
    setSavingPassword(false);
  };

  const inp = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-amber";

  return (
    <div className="space-y-5">
      <form onSubmit={handleSaveBiz} noValidate className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-display font-700 text-lg text-forge">Business Info</h2>
        <div>
          <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Business Name</label>
          <input value={bizName} onChange={(e) => setBizName(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Phone</label>
          <input type="tel" value={bizPhone} onChange={(e) => setBizPhone(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Address</label>
          <input value={bizAddr} onChange={(e) => setBizAddr(e.target.value)} className={inp} />
        </div>
        {errorBiz && <p className="text-sm text-red-600">{errorBiz}</p>}
        {savedBiz && <p className="text-sm text-green-600">✓ Saved</p>}
        <button type="submit" disabled={savingBiz} className="bg-forge hover:bg-forge-light disabled:opacity-50 text-white font-display font-700 px-4 py-2 rounded-lg text-sm transition-colors">
          {savingBiz ? "Saving…" : "Save Changes"}
        </button>
      </form>

      <form onSubmit={handleSavePersonal} noValidate className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-display font-700 text-lg text-forge">Personal Info</h2>
        <div>
          <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Full Name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Phone</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Email</label>
          <input type="email" value={profile.email} disabled className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-gray-50" />
        </div>
        {errorPersonal && <p className="text-sm text-red-600">{errorPersonal}</p>}
        {savedPersonal && <p className="text-sm text-green-600">✓ Saved</p>}
        <button type="submit" disabled={savingPersonal} className="bg-forge hover:bg-forge-light disabled:opacity-50 text-white font-display font-700 px-4 py-2 rounded-lg text-sm transition-colors">
          {savingPersonal ? "Saving…" : "Save Changes"}
        </button>
      </form>

      <form onSubmit={handleSavePassword} noValidate className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-display font-700 text-lg text-forge">Change Password</h2>
        <div>
          <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Current Password</label>
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inp} required />
        </div>
        <div>
          <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">New Password</label>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inp} required minLength={8} />
        </div>
        <div>
          <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Confirm New Password</label>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inp} required minLength={8} />
        </div>
        {errorPassword && <p className="text-sm text-red-600">{errorPassword}</p>}
        {savedPassword && <p className="text-sm text-green-600">✓ Password changed successfully</p>}
        <button type="submit" disabled={savingPassword} className="bg-forge hover:bg-forge-light disabled:opacity-50 text-white font-display font-700 px-4 py-2 rounded-lg text-sm transition-colors">
          {savingPassword ? "Changing…" : "Change Password"}
        </button>
      </form>
    </div>
  );
}
