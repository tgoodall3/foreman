"use client";

import { useState, useEffect } from "react";
import { formatDate } from "@/lib/utils";
import { useSearchParams } from "next/navigation";

export default function BillingClient({ tenant, profile }: { tenant: any; profile: any }) {
  const [loading, setLoading] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState("");
  const searchParams = useSearchParams();
  const connectStatus = searchParams.get("connect"); // "success" | "expired"

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

  const handleConnect = async () => {
    setConnectLoading(true);
    setConnectError("");
    const res = await fetch("/api/billing/connect", { method: "POST" });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setConnectError(data.error || "Could not start Stripe Connect. Try again.");
      setConnectLoading(false);
    }
  };

  const isPro = profile?.plan === "pro" || tenant?.plan === "pro";
  const isConnected = !!tenant?.stripe_connect_id && !!tenant?.stripe_connect_enabled;
  const trialEnds = tenant?.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
  const trialExpired = trialEnds ? trialEnds < new Date() : false;

  return (
    <div className="page-shell max-w-2xl px-2 sm:px-0">
      <h1 className="page-title">Billing</h1>

      <div className="surface-card p-6 mb-4">
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
      {/* Stripe Connect */}
      <div className="surface-card p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="font-display font-700 text-xl text-forge">Accept Payments</p>
            <p className="text-sm text-mist mt-1">
              Connect your Stripe account so clients can pay invoices online.
              Money goes directly to you — Foreman never touches your funds.
            </p>
          </div>
          <span className={`shrink-0 text-sm px-3 py-1 rounded-full font-600 ${
            isConnected
              ? "bg-green-100 text-green-700"
              : tenant?.stripe_connect_id
              ? "bg-amber/20 text-amber-dark"
              : "bg-gray-100 text-gray-500"
          }`}>
            {isConnected ? "Connected" : tenant?.stripe_connect_id ? "Pending" : "Not connected"}
          </span>
        </div>

        {connectStatus === "success" && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700 font-600">
            ✓ Stripe account connected successfully. You can now accept payments.
          </div>
        )}
        {connectStatus === "expired" && (
          <div className="mb-4 bg-amber/10 border border-amber/30 rounded-lg px-4 py-3 text-sm text-amber-dark font-600">
            The onboarding link expired. Click below to start again.
          </div>
        )}

        {isConnected ? (
          <div className="space-y-3">
            <p className="text-sm text-steel">
              Your Stripe account is connected and ready to accept card and ACH payments.
            </p>
            <button
              onClick={handleConnect}
              disabled={connectLoading}
              className="text-sm text-amber hover:underline font-600"
            >
              {connectLoading ? "Loading…" : "Open Stripe dashboard →"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <ul className="text-sm text-steel space-y-1">
              {[
                "Clients pay directly on the invoice page",
                "Money deposits to your bank account",
                "Card and ACH (bank transfer) supported",
                "Stripe handles all PCI compliance",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>{f}
                </li>
              ))}
            </ul>
            {connectError && (
              <p className="text-sm text-red-600">{connectError}</p>
            )}
            <button
              onClick={handleConnect}
              disabled={connectLoading}
              className="bg-[#635bff] hover:bg-[#5046e5] disabled:opacity-50 text-white font-display font-700 px-5 py-2.5 rounded-lg text-sm transition-colors"
            >
              {connectLoading
                ? "Redirecting…"
                : tenant?.stripe_connect_id
                ? "Continue Stripe setup →"
                : "Connect with Stripe →"}
            </button>
            <p className="text-xs text-mist">
              You&apos;ll be taken to Stripe to create or connect your account. Takes ~2 minutes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
