"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes until sign-out
const WARNING_MS = 13 * 60 * 1000; // show warning at 13 minutes
const WARN_SECS  = (TIMEOUT_MS - WARNING_MS) / 1000; // 300 seconds on the clock

const EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"] as const;

export default function InactivityTimer() {
  const [showWarning, setShowWarning]   = useState(false);
  const [countdown, setCountdown]       = useState(WARN_SECS);
  const warnTimer      = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const signoutTimer   = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const signOut = useCallback(async () => {
    try { await fetch("/api/auth/signout", { method: "POST" }); } catch {}
    window.location.href = "/login?signed_out=1";
  }, []);

  const clearAll = useCallback(() => {
    if (warnTimer.current)      clearTimeout(warnTimer.current);
    if (signoutTimer.current)   clearTimeout(signoutTimer.current);
    if (countdownTimer.current) clearInterval(countdownTimer.current);
  }, []);

  const reset = useCallback(() => {
    clearAll();
    setShowWarning(false);
    setCountdown(WARN_SECS);

    warnTimer.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(WARN_SECS);

      countdownTimer.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(countdownTimer.current!);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }, WARNING_MS);

    signoutTimer.current = setTimeout(signOut, TIMEOUT_MS);
  }, [clearAll, signOut]);

  useEffect(() => {
    EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, reset));
      clearAll();
    };
  }, [reset, clearAll]);

  if (!showWarning) return null;

  const mins = Math.floor(countdown / 60);
  const secs = String(countdown % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
        <div className="w-14 h-14 bg-amber/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-amber-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h2 className="font-display font-800 text-xl text-forge mb-1">Still there?</h2>
        <p className="text-sm text-mist mb-3">You&apos;ll be signed out due to inactivity in</p>

        <p className="font-display font-800 text-4xl text-forge mb-4 tabular-nums">
          {mins}:{secs}
        </p>

        <div className="flex gap-3">
          <button
            onClick={signOut}
            className="flex-1 border border-gray-300 text-forge font-600 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            Sign out
          </button>
          <button
            onClick={reset}
            className="flex-1 bg-amber hover:bg-amber-dark text-forge font-display font-700 py-2.5 rounded-lg text-sm transition-colors"
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}
