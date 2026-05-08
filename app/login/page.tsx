"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const searchParams  = useSearchParams();
  const signedOut     = searchParams.get("signed_out") === "1";

  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
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

  return (
    <>
      {signedOut && (
        <div className="mb-4 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm text-chalk text-center">
          You&apos;ve been signed out successfully.
        </div>
      )}

      <div className="bg-forge-light border border-steel rounded-xl p-6">
        <h1 className="font-display font-700 text-white text-xl mb-6">Sign in to your account</h1>

        <form onSubmit={handleLogin} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-500 text-chalk mb-1">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-required="true"
              autoComplete="email"
              className="w-full bg-forge border border-steel rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-mist focus:border-amber"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-500 text-chalk mb-1">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-required="true"
                autoComplete="current-password"
                className="w-full bg-forge border border-steel rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder:text-mist focus:border-amber"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-mist hover:text-white transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
            <a href="/forgot-password" className="text-xs text-amber hover:underline mt-1.5 inline-block">
              Forgot password?
            </a>
          </div>

          {error && (
            <div role="alert" className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber hover:bg-amber-dark disabled:opacity-50 text-forge font-display font-700 py-2.5 rounded-lg text-base transition-colors min-h-[44px]"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <main id="main-content" className="min-h-screen bg-forge flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="rounded overflow-hidden h-10 w-10 shrink-0">
              <img src="/logo_inverse.png" alt="Foreman" className="h-10 w-10" />
            </div>
            <span className="font-display font-800 text-white text-3xl tracking-wide">FOREMAN</span>
          </div>
          <p className="text-mist text-sm">Field service management for contractors</p>
        </div>

        <Suspense>
          <LoginForm />
        </Suspense>

        <div className="mt-6 space-y-2 text-center">
          <p className="text-mist text-xs">
            Don&apos;t have an account?{" "}
            <a href="/signup" className="text-amber hover:underline font-600">
              Start free trial →
            </a>
          </p>
          <p className="text-mist text-xs">
            Property manager?{" "}
            <a href="/portal" className="text-amber hover:underline">
              Submit a work order →
            </a>
          </p>
          <p className="text-mist text-xs pt-2">
            <a href="/legal/privacy" className="hover:text-chalk hover:underline">Privacy Policy</a>
            {" · "}
            <a href="/legal/terms" className="hover:text-chalk hover:underline">Terms of Service</a>
          </p>
        </div>
      </div>
    </main>
  );
}
