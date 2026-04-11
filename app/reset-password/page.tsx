"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

function ResetPasswordForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase appends access_token + refresh_token as hash params after redirect.
  // The browser client picks them up automatically on mount.
  useEffect(() => {
    const supabase = createClient();
    // getSession will exchange the hash tokens and establish a session
    supabase.auth.getSession().then(({ data }) => {
      setSessionReady(!!data.session);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8)  { setError("Password must be at least 8 characters."); return; }

    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (err) {
      setError("Unable to update your password. The link may have expired — request a new one.");
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/login"), 2500);
  };

  if (!sessionReady) {
    return (
      <div className="text-center py-8">
        <div className="w-6 h-6 border-2 border-amber border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-mist text-sm">Verifying reset link…</p>
      </div>
    );
  }

  return (
    <>
      {success ? (
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="font-display font-700 text-white text-lg">Password updated</h1>
          <p className="text-mist text-sm">Redirecting you to sign in…</p>
        </div>
      ) : (
        <>
          <h1 className="font-display font-700 text-white text-xl mb-2">Set a new password</h1>
          <p className="text-mist text-sm mb-6">Choose a strong password for your account.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-500 text-chalk mb-1">
                New password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full bg-forge border border-steel rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-mist focus:border-amber focus:outline-none"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label htmlFor="confirm" className="block text-sm font-500 text-chalk mb-1">
                Confirm new password
              </label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full bg-forge border border-steel rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-mist focus:border-amber focus:outline-none"
                placeholder="••••••••"
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
              {loading ? "Updating…" : "Update Password"}
            </button>
          </form>
        </>
      )}
    </>
  );
}

export default function ResetPasswordPage() {
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
        </div>

        <div className="bg-forge-light border border-steel rounded-xl p-6">
          <Suspense fallback={
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-amber border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          }>
            <ResetPasswordForm />
          </Suspense>
        </div>

        <p className="text-center text-mist text-xs mt-6">
          <a href="/login" className="text-amber hover:underline">← Back to sign in</a>
        </p>
      </div>
    </main>
  );
}
