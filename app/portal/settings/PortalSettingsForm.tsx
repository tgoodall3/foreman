"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
}

interface PortalSettingsFormProps {
  profile: Profile;
}

export default function PortalSettingsForm({ profile }: PortalSettingsFormProps) {
  const router = useRouter();
  const supabase = createClient();
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
      setError("Failed to update profile.");
    } else {
      router.refresh();
    }
    setLoading(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords don't match");
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
      setPasswordError(data.error || "Failed to change password");
    }
    setChangingPassword(false);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-display font-700 text-lg text-forge">Profile</h2>
          <div>
            <label htmlFor="email" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Email</label>
            <input id="email" type="email" value={profile.email} disabled className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-gray-50" />
            <p className="text-xs text-mist mt-1">Contact your property manager to change email.</p>
          </div>
          <div>
            <label htmlFor="fullName" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Full Name</label>
            <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-amber" />
          </div>
          <div>
            <label htmlFor="phone" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Phone</label>
            <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-amber" />
          </div>
        </div>

        {error && <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        <button type="submit" disabled={loading} className="bg-amber hover:bg-amber-dark disabled:opacity-50 text-forge font-display font-700 px-5 py-2.5 rounded-lg text-sm transition-colors">
          {loading ? "Saving…" : "Save Changes"}
        </button>
      </form>

      <form onSubmit={handleChangePassword} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-display font-700 text-lg text-forge">Change Password</h2>
          <div>
            <label htmlFor="currentPassword" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Current Password</label>
            <input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-amber" />
          </div>
          <div>
            <label htmlFor="newPassword" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">New Password</label>
            <input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-amber" />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Confirm New Password</label>
            <input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-amber" />
          </div>
        </div>

        {passwordError && <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{passwordError}</div>}
        {passwordSuccess && <div role="alert" className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">✓ Password changed successfully</div>}

        <button type="submit" disabled={changingPassword} className="bg-amber hover:bg-amber-dark disabled:opacity-50 text-forge font-display font-700 px-5 py-2.5 rounded-lg text-sm transition-colors">
          {changingPassword ? "Changing…" : "Change Password"}
        </button>
      </form>
    </>
  );
}