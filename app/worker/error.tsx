"use client";

import { useEffect } from "react";
import { useLanguage } from "@/lib/i18n";

export default function WorkerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLanguage();

  useEffect(() => {
    console.error("[worker]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
      <h2 className="font-display font-800 text-xl text-forge mb-2">{t("common.somethingWentWrong")}</h2>
      <p className="text-mist text-sm mb-6 max-w-sm">
        {t("common.unexpectedError")}
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="bg-amber hover:bg-amber-dark text-forge font-display font-700 px-5 py-2.5 rounded-lg text-sm transition-colors"
        >
          {t("common.tryAgain")}
        </button>
        <a
          href="/worker"
          className="border border-gray-300 text-forge font-600 px-5 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
        >
          {t("jobs.goToMyJobs")}
        </a>
      </div>
      {process.env.NODE_ENV !== "production" && error.message && (
        <pre className="mt-6 text-left bg-gray-100 border border-gray-200 rounded-lg p-3 text-xs text-steel max-w-lg overflow-auto">
          {error.message}
        </pre>
      )}
    </div>
  );
}
