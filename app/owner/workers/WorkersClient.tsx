"use client";

import { useState } from "react";
import { Profile } from "@/types";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/ToastContainer";
import { useLanguage } from "@/lib/i18n";

export default function WorkersClient({ workers: initial, tenantId }: { workers: Profile[]; tenantId: string }) {
  const { addToast } = useToast();
  const { t } = useLanguage();
  const [workers, setWorkers] = useState(initial);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviting, setInviting] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [rateInput, setRateInput] = useState("");
  const [savingRate, setSavingRate] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCreds, setShowCreds] = useState(false);
  const [hideTimer, setHideTimer] = useState<NodeJS.Timeout | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setError("");
    setSuccess("");

    const res = await fetch("/api/workers/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        fullName: inviteName,
        email: inviteEmail,
        phone: invitePhone,
        password: invitePassword,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to invite worker");
    } else {
      setWorkers((prev) => [data.profile, ...prev]);
      setSuccess(t("workers.workerAdded", { name: inviteName }));
      setShowCreds(true);
      if (hideTimer) clearTimeout(hideTimer);
      setHideTimer(setTimeout(() => setShowCreds(false), 30000));
      setInviteName(""); setInviteEmail(""); setInvitePhone(""); setInvitePassword("");
      addToast(t("workers.workerAdded", { name: inviteName }), "success");
    }
    setInviting(false);
  };

  const saveRate = async (workerId: string) => {
    setSavingRate(true);
    const rate = rateInput === "" ? null : Number(rateInput);
    const res = await fetch(`/api/workers/${workerId}/rate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hourly_rate: rate }),
    });
    if (res.ok) {
      setWorkers((prev) => prev.map((w) => w.id === workerId ? { ...w, hourly_rate: rate } : w));
      addToast("Hourly rate updated.", "success");
    } else {
      addToast("Failed to update rate.", "error");
    }
    setSavingRate(false);
    setEditingRate(null);
  };

  const toggleActive = async (worker: Profile) => {
    setToggling(worker.id);
    const res = await fetch("/api/workers/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workerId: worker.id, isActive: !worker.is_active }),
    });
    if (res.ok) {
      setWorkers((prev) => prev.map((w) => w.id === worker.id ? { ...w, is_active: !w.is_active } : w));
      addToast(
        t("workers.toggleSuccess", { action: worker.is_active ? "deactivated" : "activated" }),
        "info"
      );
    }
    setToggling(null);
  };

  return (
    <div className="page-shell page-shell-tight">
      <div className="page-header">
        <div className="page-header-copy">
          <h1 className="page-title">{t("workers.title")}</h1>
          <p className="page-subtitle">{t("workers.activeCount", { count: workers.filter((w) => w.is_active).length })}</p>
        </div>
        <button
          onClick={() => { setShowInvite(true); setSuccess(""); setError(""); }}
          className="action-button-primary w-full sm:w-auto"
        >
          {t("workers.addWorker")}
        </button>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="invite-title">
          <div className="surface-card p-6 w-full max-w-sm">
            <h2 id="invite-title" className="font-display font-700 text-xl text-forge mb-4">{t("workers.addWorkerTitle")}</h2>
            <form onSubmit={handleInvite} noValidate className="space-y-3">
              <div>
                <label htmlFor="invite-name" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("workers.fullName")} *</label>
                <input id="invite-name" type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber" placeholder="John Smith" />
              </div>
              <div>
                <label htmlFor="invite-email" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("workers.email")} *</label>
                <input id="invite-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber" placeholder="john@company.com" />
              </div>
              <div>
                <label htmlFor="invite-phone" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("workers.phone")}</label>
                <input id="invite-phone" type="tel" value={invitePhone} onChange={(e) => setInvitePhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber" placeholder="(555) 000-0000" />
              </div>
              <div>
                <label htmlFor="invite-password" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("workers.tempPassword")} *</label>
                <input id="invite-password" type="text" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} required minLength={8}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-amber" placeholder={t("auth.passwordMinLength")} />
                <p className="text-xs text-mist mt-1">{t("workers.tempPasswordNote")}</p>
              </div>
              {error && <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
              {success && (
                <div role="status" className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 space-y-1">
                  <p>{success}</p>
                  {showCreds && (
                    <div className="flex items-center gap-2">
                      <code className="bg-white border border-green-200 rounded px-2 py-1 text-[11px] text-forge">{inviteEmail} / {invitePassword}</code>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(`${inviteEmail} / ${invitePassword}`)}
                        className="text-amber font-700 hover:underline"
                      >
                        Copy
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowInvite(false)}
                  className="flex-1 border border-gray-300 text-forge font-display font-700 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                  {success ? t("common.close") : t("common.cancel")}
                </button>
                {!success && (
                  <button type="submit" disabled={inviting || !inviteName || !inviteEmail || invitePassword.length < 8}
                    className="flex-1 bg-forge hover:bg-forge-light disabled:opacity-50 text-white font-display font-700 py-2.5 rounded-lg text-sm transition-colors">
                    {inviting ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        {t("common.saving")}
                      </div>
                    ) : (
                      t("workers.addWorkerTitle")
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Workers list */}
        <div className="surface-card overflow-hidden">
        {workers.length === 0 ? (
          <div className="p-8 sm:p-12 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <p className="font-display font-700 text-xl text-forge mb-1">{t("workers.noWorkers")}</p>
            <p className="text-mist text-sm mb-4">{t("workers.noWorkersNote")}</p>
            <button onClick={() => setShowInvite(true)} className="bg-amber text-forge font-display font-700 px-4 py-2 rounded-lg text-sm hover:bg-amber-dark transition-colors">
              {t("workers.addWorkerTitle")}
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden sm:table w-full text-sm" aria-label="Workers list">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">{t("workers.workerColumn")}</th>
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">{t("workers.phone")}</th>
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">{t("workers.addedColumn")}</th>
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">Hourly Rate</th>
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">{t("workers.statusColumn")}</th>
                  <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">{t("workers.actionsColumn")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {workers.map((worker) => (
                  <tr key={worker.id} className={worker.is_active ? "" : "opacity-50"}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-steel rounded-full flex items-center justify-center shrink-0">
                          <span className="text-white text-xs font-700">{worker.full_name[0]}</span>
                        </div>
                        <div>
                          <p className="font-500 text-forge">{worker.full_name}</p>
                          <p className="text-xs text-mist">{worker.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-mist">{worker.phone || "—"}</td>
                    <td className="px-4 py-3 text-mist">{formatDate(worker.created_at)}</td>
                    <td className="px-4 py-3">
                      {editingRate === worker.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-mist text-xs">$</span>
                          <input
                            type="number"
                            value={rateInput}
                            onChange={(e) => setRateInput(e.target.value)}
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            autoFocus
                            className="w-20 border border-amber rounded px-2 py-1 text-xs focus:outline-none"
                          />
                          <button onClick={() => saveRate(worker.id)} disabled={savingRate} className="text-xs text-amber font-700 hover:underline">
                            {savingRate ? "…" : "Save"}
                          </button>
                          <button onClick={() => setEditingRate(null)} className="text-xs text-mist hover:text-forge">✕</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingRate(worker.id); setRateInput(worker.hourly_rate != null ? String(worker.hourly_rate) : ""); }}
                          className="text-sm text-forge hover:text-amber transition-colors"
                        >
                          {worker.hourly_rate != null ? `$${worker.hourly_rate}/hr` : <span className="text-mist text-xs">Set rate</span>}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${worker.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {worker.is_active ? t("common.active") : t("common.inactive")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(worker)}
                        disabled={toggling === worker.id}
                        className="text-xs text-mist hover:text-forge transition-colors disabled:opacity-50 flex items-center gap-1"
                        aria-label={`${worker.is_active ? t("workers.deactivate") : t("workers.activate")} ${worker.full_name}`}
                      >
                        {toggling === worker.id ? (
                          <>
                            <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                            {worker.is_active ? t("workers.deactivating") : t("workers.activating")}
                          </>
                        ) : (
                          worker.is_active ? t("workers.deactivate") : t("workers.activate")
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {workers.map((worker) => (
                <div key={worker.id} className={`p-4 ${worker.is_active ? "" : "opacity-50"}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-steel rounded-full flex items-center justify-center shrink-0">
                        <span className="text-white text-sm font-700">{worker.full_name[0]}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-600 text-forge truncate">{worker.full_name}</p>
                        <p className="text-sm text-mist truncate">{worker.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${worker.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {worker.is_active ? t("common.active") : t("common.inactive")}
                          </span>
                          <span className="text-xs text-mist">{formatDate(worker.created_at)}</span>
                        </div>
                        {worker.phone && <p className="text-xs text-mist mt-1">{worker.phone}</p>}
                        {worker.hourly_rate != null && (
                          <p className="text-xs text-mist mt-0.5">${worker.hourly_rate}/hr</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleActive(worker)}
                      disabled={toggling === worker.id}
                      className="text-xs text-mist hover:text-forge transition-colors shrink-0 ml-2 disabled:opacity-50 flex items-center gap-1"
                      aria-label={`${worker.is_active ? t("workers.deactivate") : t("workers.activate")} ${worker.full_name}`}
                    >
                      {toggling === worker.id ? (
                        <>
                          <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                          {worker.is_active ? t("workers.deactivating") : t("workers.activating")}
                        </>
                      ) : (
                        worker.is_active ? t("workers.deactivate") : t("workers.activate")
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
