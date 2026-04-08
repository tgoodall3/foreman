"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<"account" | "business">("account");

  // Account fields
  const [fullName, setFullName]     = useState("");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");

  // Business fields
  const [bizName, setBizName]       = useState("");
  const [bizPhone, setBizPhone]     = useState("");
  const [bizAddress, setBizAddress] = useState("");

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleAccountNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || password.length < 8) {
      setError("Please fill all fields. Password must be at least 8 characters.");
      return;
    }
    setError("");
    setStep("business");
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizName.trim()) { setError("Business name is required."); return; }
    setLoading(true);
    setError("");

    // 1. Create account server-side
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, password, bizName, bizPhone, bizAddress }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Signup failed. Please try again.");
      setLoading(false);
      return;
    }

    // 2. Sign in server-side so auth cookies are persisted for protected routes.
    const signInRes = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const signInData = await signInRes.json();
    if (!signInRes.ok || signInData.error) {
      setError("Account created but sign-in failed. Please go to the login page.");
      setLoading(false);
      return;
    }

    // 3. Redirect to Stripe checkout to collect payment
    const checkoutRes = await fetch("/api/billing/checkout", { method: "POST" });
    const checkoutData = await checkoutRes.json();
    if (checkoutData.url) {
      window.location.href = checkoutData.url;
    } else {
      // Fallback: go to billing page if checkout URL is missing
      router.refresh();
      router.push("/owner/settings/billing");
    }
  };

  return (
    <main id="main-content" className="min-h-screen bg-forge flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-amber rounded flex items-center justify-center">
              <span className="font-display font-800 text-forge text-xl">F</span>
            </div>
            <span className="font-display font-800 text-white text-3xl tracking-wide">FOREMAN</span>
          </div>
          <p className="text-mist text-sm mt-2">Field service management for contractors</p>
        </div>

        <div className="bg-forge-light border border-steel rounded-xl p-6">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {["account", "business"].map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-6 h-6 rounded-full text-xs font-700 flex items-center justify-center shrink-0 ${
                  step === s ? "bg-amber text-forge" :
                  (step === "business" && s === "account") ? "bg-green-500 text-white" : "bg-steel text-mist"
                }`}>
                  {step === "business" && s === "account" ? "✓" : i + 1}
                </div>
                <span className={`text-xs font-500 capitalize ${step === s ? "text-white" : "text-mist"}`}>{s}</span>
                {i === 0 && <div className="flex-1 h-px bg-steel" />}
              </div>
            ))}
          </div>

          {step === "account" ? (
            <form onSubmit={handleAccountNext} noValidate className="space-y-4">
              <h1 className="font-display font-700 text-white text-xl mb-2">Create your account</h1>
              <div>
                <label htmlFor="full-name" className="block text-sm font-500 text-chalk mb-1">Full Name</label>
                <input id="full-name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                  required aria-required="true" autoComplete="name"
                  className="w-full bg-forge border border-steel rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-mist focus:border-amber"
                  placeholder="Tyler Reynolds" />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-500 text-chalk mb-1">Email</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  required aria-required="true" autoComplete="email"
                  className="w-full bg-forge border border-steel rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-mist focus:border-amber"
                  placeholder="you@company.com" />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-500 text-chalk mb-1">Password</label>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  required aria-required="true" autoComplete="new-password" minLength={8}
                  className="w-full bg-forge border border-steel rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-mist focus:border-amber"
                  placeholder="Min 8 characters" />
              </div>
              {error && <div role="alert" className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</div>}
              <button type="submit" className="w-full bg-amber hover:bg-amber-dark text-forge font-display font-700 py-2.5 rounded-lg text-base transition-colors min-h-[44px]">
                Continue →
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} noValidate className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <button type="button" onClick={() => setStep("account")} className="text-mist hover:text-white text-sm transition-colors">←</button>
                <h2 className="font-display font-700 text-white text-xl">Your business</h2>
              </div>
              <div>
                <label htmlFor="biz-name" className="block text-sm font-500 text-chalk mb-1">Business Name <span className="text-red-400">*</span></label>
                <input id="biz-name" type="text" value={bizName} onChange={(e) => setBizName(e.target.value)}
                  required aria-required="true"
                  className="w-full bg-forge border border-steel rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-mist focus:border-amber"
                  placeholder="Precision Contracting Group" />
              </div>
              <div>
                <label htmlFor="biz-phone" className="block text-sm font-500 text-chalk mb-1">Phone</label>
                <input id="biz-phone" type="tel" value={bizPhone} onChange={(e) => setBizPhone(e.target.value)}
                  autoComplete="tel"
                  className="w-full bg-forge border border-steel rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-mist focus:border-amber"
                  placeholder="(555) 000-0000" />
              </div>
              <div>
                <label htmlFor="biz-address" className="block text-sm font-500 text-chalk mb-1">Address</label>
                <input id="biz-address" type="text" value={bizAddress} onChange={(e) => setBizAddress(e.target.value)}
                  autoComplete="street-address"
                  className="w-full bg-forge border border-steel rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-mist focus:border-amber"
                  placeholder="123 Main St, Indianapolis, IN" />
              </div>
              {error && <div role="alert" className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</div>}
              <button type="submit" disabled={loading}
                className="w-full bg-amber hover:bg-amber-dark disabled:opacity-50 text-forge font-display font-700 py-2.5 rounded-lg text-base transition-colors min-h-[44px]">
                {loading ? "Setting up account…" : "Continue to Payment →"}
              </button>
              <p className="text-xs text-mist text-center">$50/month · Cancel anytime</p>
            </form>
          )}
        </div>

        <p className="text-center text-mist text-sm mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-amber hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
