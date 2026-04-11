"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);
    if (err) {
      setError("Unable to send reset email. Please check the address and try again.");
      return;
    }
    setSent(true);
  };

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
          <p className="text-mist text-sm">Field service management for contractors</p>
        </div>

        <div className="bg-forge-light border border-steel rounded-xl p-6">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="font-display font-700 text-white text-lg">Check your email</h1>
              <p className="text-mist text-sm leading-relaxed">
                We sent a password reset link to <span className="text-chalk font-600">{email}</span>.
                The link expires in 1 hour.
              </p>
              <p className="text-mist text-xs">Didn&apos;t receive it? Check your spam folder.</p>
            </div>
          ) : (
            <>
              <h1 className="font-display font-700 text-white text-xl mb-2">Reset your password</h1>
              <p className="text-mist text-sm mb-6">
                Enter your account email and we&apos;ll send you a link to set a new password.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
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
                    autoComplete="email"
                    className="w-full bg-forge border border-steel rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-mist focus:border-amber focus:outline-none"
                    placeholder="you@company.com"
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
                  {loading ? "Sending…" : "Send Reset Link"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-mist text-xs mt-6">
          <Link href="/login" className="text-amber hover:underline">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
