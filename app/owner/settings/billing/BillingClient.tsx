"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";

export default function BillingClient({ tenant, profile }: { tenant: any; profile: any }) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    const res = await fetch("/api/billing/checkout", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else setLoading(false);
  };

  const [manageError, setManageError] = useState("");

  const handleManage = async () => {
    setLoading(true);
    setManageError("");
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setManageError(data.error || "Unable to open billing portal. Contact support.");
      setLoading(false);
    }
  };

  const isPro = profile?.plan === "pro" || tenant?.plan === "pro";
  const trialEnds = tenant?.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
  const trialExpired = trialEnds ? trialEnds < new Date() : false;

  return (
    <div className="p-6 max-w-2xl w-full mx-auto px-2 sm:px-0">
      <h1 className="font-display font-800 text-3xl text-forge mb-6">Billing</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-display font-700 text-xl text-forge">
              {isPro ? "Pro Plan" : "Free Trial"}
            </p>
            <p className="text-sm text-mist mt-1">
              {isPro ? "Unlimited jobs, workers, and property managers" :
                trialExpired ? "Your trial has expired" :
                trialEnds ? `Trial ends ${formatDate(trialEnds)}` : "14-day free trial"}
            </p>
          </div>
          <span className={`badge text-sm px-3 py-1 ${isPro ? "bg-green-100 text-green-700" : trialExpired ? "bg-red-100 text-red-600" : "bg-amber/20 text-amber-dark"}`}>
            {isPro ? "Active" : trialExpired ? "Expired" : "Trial"}
          </span>
        </div>

        {!isPro && (
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-baseline gap-1 mb-3">
              <span className="font-display font-800 text-3xl text-forge">$50</span>
              <span className="text-mist text-sm">/month</span>
            </div>
            <ul className="text-sm text-steel space-y-1 mb-4">
              {["Unlimited jobs & work orders", "Unlimited workers", "Unlimited property managers", "Photo & note tracking", "Invoice generation", "Email notifications", "Priority support"].map((f) => (
                <li key={f} className="flex items-center gap-2"><span className="text-green-500">✓</span>{f}</li>
              ))}
            </ul>
            <button onClick={handleUpgrade} disabled={loading}
              className="w-full bg-amber hover:bg-amber-dark disabled:opacity-50 text-forge font-display font-700 py-3 rounded-lg text-base transition-colors min-h-[44px]">
              {loading ? "Redirecting…" : "Upgrade to Pro →"}
            </button>
          </div>
        )}

        {isPro && (
          <div className="border-t border-gray-100 pt-4">
            <button onClick={handleManage} disabled={loading}
              className="text-sm text-amber hover:underline font-600 transition-colors">
              {loading ? "Loading…" : "Manage subscription →"}
            </button>
            {manageError && (
              <p className="text-xs text-red-600 mt-2">{manageError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
