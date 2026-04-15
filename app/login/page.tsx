"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const searchParams  = useSearchParams();
  const signedOut     = searchParams.get("signed_out") === "1";

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

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
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-required="true"
              autoComplete="current-password"
              className="w-full bg-forge border border-steel rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-mist focus:border-amber"
              placeholder="••••••••"
            />
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
          <div className="flex justify-center mb-3">
            <img src="/logo.png" alt="Foreman" className="h-14 w-auto" />
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
