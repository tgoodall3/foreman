"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PortalSetupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const next = searchParams.get("next") || "/portal";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("This setup link is invalid.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    const setupRes = await fetch("/api/portal/setup-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const setupData = await setupRes.json().catch(() => ({}));
    if (!setupRes.ok) {
      setError(setupData.error || "Failed to create your account.");
      setLoading(false);
      return;
    }

    const signInRes = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: setupData.email, password }),
    });
    const signInData = await signInRes.json().catch(() => ({}));
    setLoading(false);

    if (!signInRes.ok || signInData.error) {
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    router.refresh();
    router.push(next.startsWith("/") ? next : "/portal");
  };

  return (
    <div className="bg-forge-light border border-steel rounded-xl p-6">
      <h1 className="font-display font-700 text-white text-xl mb-2">Create your portal account</h1>
      <p className="text-mist text-sm mb-6">Set a password once. After that, you’ll sign in securely like a normal account.</p>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="password" className="block text-sm font-500 text-chalk mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            className="w-full bg-forge border border-steel rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-mist focus:border-amber"
            placeholder="Min 8 characters"
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="block text-sm font-500 text-chalk mb-1">
            Confirm Password
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
            className="w-full bg-forge border border-steel rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-mist focus:border-amber"
            placeholder="Repeat password"
          />
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
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </form>
    </div>
  );
}

export default function PortalSetupPage() {
  return (
    <main className="min-h-screen bg-forge flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-10 h-10 bg-amber rounded flex items-center justify-center">
              <span className="font-display font-800 text-forge text-xl">F</span>
            </div>
            <span className="font-display font-800 text-white text-3xl tracking-wide">FOREMAN</span>
          </div>
          <p className="text-mist text-sm">Property manager portal setup</p>
        </div>
        <Suspense>
          <PortalSetupForm />
        </Suspense>
      </div>
    </main>
  );
}
