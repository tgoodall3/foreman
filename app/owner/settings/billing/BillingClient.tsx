"use client";

import { useState, useEffect } from "react";
import { formatDate } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/lib/i18n";

export default function BillingClient({ tenant, profile }: { tenant: any; profile: any }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState("");
  const searchParams = useSearchParams();
  const connectStatus = searchParams.get("connect"); // "success" | "expired"
  const [connectRefreshed, setConnectRefreshed] = useState(false);

  // When Stripe onboarding completes, update stripe_connect_enabled in the DB
  // then reload so the UI reflects the real status (webhooks may not be set up).
  useEffect(() => {
    if (connectStatus === "success" && !connectRefreshed) {
      setConnectRefreshed(true);
      fetch("/api/billing/connect", { method: "PATCH" })
        .then(() => { window.location.href = "/owner/settings/billing"; })
        .catch(() => { /* silent — webhook will catch it eventually */ });
    }
  }, [connectStatus, connectRefreshed]);

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
      setManageError(data.error || t("billing.portalError"));
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
      setConnectError(data.error || t("billing.connectError"));
      setConnectLoading(false);
    }
  };

  const isPro = ["pro", "comped"].includes(profile?.plan) || ["pro", "comped"].includes(tenant?.plan);
  const isConnected = !!tenant?.stripe_connect_id && !!tenant?.stripe_connect_enabled;
  const trialEnds = tenant?.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
  const trialExpired = trialEnds ? trialEnds < new Date() : false;

  return (
    <div className="page-shell max-w-2xl px-2 sm:px-0">
      <h1 className="page-title">{t("billing.title")}</h1>

      <div className="surface-card p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-display font-700 text-xl text-forge">
              {isPro ? t("billing.proPlan") : t("billing.freeTrial")}
            </p>
            <p className="text-sm text-mist mt-1">
              {isPro ? t("billing.proDescription") :
                trialExpired ? t("billing.trialExpired") :
                trialEnds ? t("billing.trialEnds", { date: formatDate(trialEnds) }) : t("billing.trialDays")}
            </p>
          </div>
          <span className={`badge text-sm px-3 py-1 ${isPro ? "bg-green-100 text-green-700" : trialExpired ? "bg-red-100 text-red-600" : "bg-amber/20 text-amber-dark"}`}>
            {isPro ? t("billing.active") : trialExpired ? t("billing.expired") : t("billing.trial")}
          </span>
        </div>

        {!isPro && (
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-baseline gap-1 mb-3">
              <span className="font-display font-800 text-3xl text-forge">$50</span>
              <span className="text-mist text-sm">{t("billing.perMonth")}</span>
            </div>
            <ul className="text-sm text-steel space-y-1 mb-4">
              {[t("billing.featureJobs"), t("billing.featureWorkers"), t("billing.featurePMs"), t("billing.featurePhotos"), t("billing.featureInvoices"), t("billing.featureEmails"), t("billing.featureSupport")].map((f) => (
                <li key={f} className="flex items-center gap-2"><span className="text-green-500">✓</span>{f}</li>
              ))}
            </ul>
            <button onClick={handleUpgrade} disabled={loading}
              className="w-full bg-amber hover:bg-amber-dark disabled:opacity-50 text-forge font-display font-700 py-3 rounded-lg text-base transition-colors min-h-[44px]">
              {loading ? t("billing.redirecting") : t("billing.upgradePro")}
            </button>
          </div>
        )}

        {isPro && (
          <div className="border-t border-gray-100 pt-4">
            <button onClick={handleManage} disabled={loading}
              className="text-sm text-amber hover:underline font-600 transition-colors">
              {loading ? t("billing.loadingPortal") : t("billing.manageSubscription")}
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
            <p className="font-display font-700 text-xl text-forge">{t("billing.acceptPayments")}</p>
            <p className="text-sm text-mist mt-1">
              {t("billing.stripeDescription")}
            </p>
          </div>
          <span className={`shrink-0 text-sm px-3 py-1 rounded-full font-600 ${
            isConnected
              ? "bg-green-100 text-green-700"
              : tenant?.stripe_connect_id
              ? "bg-amber/20 text-amber-dark"
              : "bg-gray-100 text-gray-500"
          }`}>
            {isConnected ? t("billing.connected") : tenant?.stripe_connect_id ? t("billing.pending") : t("billing.notConnected")}
          </span>
        </div>

        {connectStatus === "success" && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700 font-600">
            ✓ {t("billing.connectSuccess")}
          </div>
        )}
        {connectStatus === "expired" && (
          <div className="mb-4 bg-amber/10 border border-amber/30 rounded-lg px-4 py-3 text-sm text-amber-dark font-600">
            {t("billing.linkExpired")}
          </div>
        )}

        {isConnected ? (
          <div className="space-y-3">
            <p className="text-sm text-steel">
              {t("billing.stripeReady")}
            </p>
            <button
              onClick={handleConnect}
              disabled={connectLoading}
              className="text-sm text-amber hover:underline font-600"
            >
              {connectLoading ? t("billing.loadingPortal") : t("billing.openDashboard")}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <ul className="text-sm text-steel space-y-1">
              {[t("billing.stripeFeature1"), t("billing.stripeFeature2"), t("billing.stripeFeature3"), t("billing.stripeFeature4")].map((f) => (
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
                ? t("billing.redirecting")
                : tenant?.stripe_connect_id
                ? t("billing.continueSetup")
                : t("billing.connectStripe")}
            </button>
            <p className="text-xs text-mist">
              {t("billing.stripeNote")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
