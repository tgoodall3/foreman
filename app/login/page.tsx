"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/lib/i18n";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import { Eye, EyeOff, CheckCircle } from "lucide-react";

const FEATURES = [
  { title: "Jobs & Scheduling", desc: "Assign, track, and schedule every job in real time." },
  { title: "Invoicing & Billing", desc: "Send invoices and collect payments without the paperwork." },
  { title: "Worker Management", desc: "Clock in/out, timesheets, and field communication — all in one place." },
];

function LoginForm() {
  const searchParams    = useSearchParams();
  const signedOut       = searchParams.get("signed_out") === "1";
  const { t } = useLanguage();

  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res    = await fetch("/api/auth/signin", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, password }),
    });
    const result = await res.json();

    if (!res.ok || result.error) {
      setError(result.error || "Unable to sign in. Please check your credentials.");
      setLoading(false);
      return;
    }

    const next = searchParams.get("next");
    if (next?.startsWith("/")) {
      window.location.href = next;
    } else if (result.role === "owner") {
      window.location.href = "/owner";
    } else if (result.role === "worker") {
      window.location.href = "/worker";
    } else if (result.role === "property_manager") {
      window.location.href = "/portal";
    } else {
      window.location.href = "/";
    }
  };

  const inputBase = [
    "w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-forge placeholder:text-gray-400",
    "transition-all duration-150 focus:outline-none",
    "border-gray-300 hover:border-gray-400 focus:border-amber focus:shadow-[0_0_0_3px_rgba(245,158,11,0.15)]",
  ].join(" ");

  return (
    <div className="w-full">
      {signedOut && (
        <div className="mb-5 flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
          {t("auth.signedOut")}
        </div>
      )}

      <div className="mb-7">
        <h1 className="font-display font-800 text-3xl text-forge tracking-wide leading-tight">
          {t("auth.signIn")}
        </h1>
        <p className="mt-1.5 text-sm text-mist">Enter your credentials to access your account.</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-600 text-forge">
            {t("auth.emailAddress")}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-required="true"
            autoComplete="email"
            className={inputBase}
            placeholder="you@company.com"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-600 text-forge">
              {t("auth.password")}
            </label>
            <a
              href="/forgot-password"
              className="text-xs text-amber hover:text-amber-dark font-500 transition-colors"
            >
              {t("auth.forgotPassword")}
            </a>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-required="true"
              autoComplete="current-password"
              className={`${inputBase} pr-10`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-forge transition-colors"
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            >
              {showPassword
                ? <EyeOff className="w-4 h-4" />
                : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 border-l-4 border-l-red-500 px-4 py-3 text-sm text-red-800"
          >
            <span className="shrink-0 mt-0.5 h-4 w-4 rounded-full bg-red-500 flex items-center justify-center text-white text-[10px] font-700">!</span>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email || !password}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber hover:bg-amber-dark disabled:opacity-50 disabled:pointer-events-none text-forge font-display font-700 py-2.5 text-base transition-all shadow-sm hover:shadow-card-md active:scale-[0.99] min-h-[48px]"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-forge/30 border-t-forge animate-spin" />
              {t("auth.signingIn")}
            </>
          ) : (
            t("auth.signInButton")
          )}
        </button>
      </form>

      <div className="mt-7 pt-6 border-t border-gray-100 space-y-3 text-center">
        <p className="text-sm text-mist">
          {t("auth.noAccount")}{" "}
          <a href="/signup" className="text-amber hover:text-amber-dark font-600 transition-colors">
            {t("auth.startTrial")}
          </a>
        </p>
        <p className="text-xs text-gray-400">
          {t("auth.propertyManager")}{" "}
          <a href="/portal" className="text-amber hover:text-amber-dark transition-colors">
            {t("auth.submitWorkOrder")}
          </a>
        </p>
        <p className="text-xs text-gray-400 pt-1">
          <a href="/legal/privacy" className="hover:text-gray-600 transition-colors">{t("auth.privacyPolicy")}</a>
          {" · "}
          <a href="/legal/terms" className="hover:text-gray-600 transition-colors">{t("auth.termsOfService")}</a>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex">

      {/* Left brand panel — desktop only */}
      <div className="hidden lg:flex lg:w-[44%] xl:w-[42%] bg-forge flex-col justify-between p-10 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber shrink-0">
            <span className="font-display font-800 text-forge text-xl leading-none">F</span>
          </div>
          <span className="font-display font-800 text-white text-2xl tracking-widest">FOREMAN</span>
        </div>

        {/* Center content */}
        <div>
          <h2 className="font-display font-800 text-[2.6rem] leading-[1.15] text-white mb-8">
            Field service management built for general contractors.
          </h2>
          <div className="space-y-5">
            {FEATURES.map(({ title, desc }) => (
              <div key={title} className="flex items-start gap-3.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber/20 mt-0.5">
                  <div className="h-2 w-2 rounded-full bg-amber" />
                </div>
                <div>
                  <p className="text-white text-sm font-600 leading-snug">{title}</p>
                  <p className="text-mist text-xs mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-mist text-xs">
          © {new Date().getFullYear()} Foreman · Built for the field
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-6 py-10 min-h-screen lg:min-h-0">
        <div className="w-full max-w-[380px]">

          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center mb-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forge shrink-0">
                <span className="font-display font-800 text-amber text-xl leading-none">F</span>
              </div>
              <span className="font-display font-800 text-forge text-2xl tracking-widest">FOREMAN</span>
            </div>
            <p className="text-mist text-sm text-center">{t("auth.tagline")}</p>
          </div>

          <Suspense>
            <LoginForm />
          </Suspense>

          <div className="mt-6 flex justify-center">
            <LanguageSwitcher />
          </div>
        </div>
      </div>

    </div>
  );
}
