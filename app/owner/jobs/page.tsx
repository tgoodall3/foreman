import { requireOwner } from "@/lib/auth";
import { getOwnerJobs } from "@/lib/services/owner";
import { formatDate, JOB_STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/utils";
import Link from "next/link";
import { getServerT } from "@/lib/i18n/server";
import JobsSearchBar from "@/components/owner/JobsSearchBar";

const ACTIVE_STATUSES = ["pending", "scheduled", "in_progress"] as const;

function SortTh({
  col, label, sort, sortDir, status, search,
}: { col: string; label: string; sort: string; sortDir: string; status?: string; search?: string }) {
  const isActive = sort === col;
  const nextDir = isActive && sortDir === "asc" ? "desc" : "asc";
  const params = new URLSearchParams({ sort: col, sortDir: nextDir, ...(status ? { status } : {}), ...(search ? { search } : {}) });
  return (
    <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">
      <Link href={`/owner/jobs?${params}`} className="inline-flex items-center gap-1 hover:text-forge transition-colors">
        {label}
        <span className="text-[10px]">{isActive ? (sortDir === "asc" ? "↑" : "↓") : <span className="opacity-30">↕</span>}</span>
      </Link>
    </th>
  );
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; past?: string; search?: string; sort?: string; sortDir?: string }>;
}) {
  const { status: statusParam, page: pageParam, past, search, sort: sortParam, sortDir: sortDirParam } = await searchParams;
  const profile = await requireOwner();
  const t = await getServerT();
  const showPast = past === "1";
  const page = Math.max(1, Number(pageParam || "1"));
  const status = showPast ? undefined : statusParam;
  const sort = sortParam || "created_at";
  const sortDir = (sortDirParam === "asc" ? "asc" : "desc") as "asc" | "desc";

  const result = await getOwnerJobs(profile, status, page, 8, {
    pastOnly: showPast,
    search,
    sortBy: sort,
    sortDir,
  });

  const jobs = result.jobs as any[];
  const count = result.count;
  const pageCount = Math.ceil(count / 8);

  const activeStatuses = ACTIVE_STATUSES as readonly string[];
  const showInvoiceCta = status === "completed";

  return (
    <div className="page-shell page-shell-wide">
      <div className="page-header">
        <div className="page-header-copy">
          <h1 className="page-title">{t("jobs.title")}</h1>
          <p className="page-subtitle">{t("common.total", { count })}</p>
        </div>
        <div className="flex items-center gap-2">
          {!showPast && (
            <JobsSearchBar defaultValue={search ?? ""} status={status} />
          )}
          <Link href="/owner/jobs/new" className="action-button-primary whitespace-nowrap">
            {t("jobs.newJob")}
          </Link>
        </div>
      </div>

      {/* Active / Past toggle */}
      <div className="flex items-center gap-3 mb-5">
        <Link
          href="/owner/jobs"
          className={`px-4 py-1.5 rounded-full text-sm font-600 transition-colors ${!showPast ? "bg-forge text-white" : "text-mist hover:text-forge"}`}
        >
          {t("jobs.activeTab")}
        </Link>
        <Link
          href="/owner/jobs?past=1"
          className={`px-4 py-1.5 rounded-full text-sm font-600 transition-colors ${showPast ? "bg-forge text-white" : "text-mist hover:text-forge"}`}
        >
          {t("jobs.pastTab")}
        </Link>
      </div>

      {/* Status filter — active tab only, show only non-past statuses */}
      {!showPast && (
        <div className="flex gap-2 flex-wrap mb-6" role="group" aria-label="Filter jobs by status">
          <Link
            href={search ? `/owner/jobs?search=${search}` : "/owner/jobs"}
            className={`px-3 py-1.5 rounded-full text-xs font-600 border transition-colors ${
              !status ? "bg-forge text-white border-forge" : "border-gray-300 text-mist hover:border-forge"
            }`}
          >
            {t("common.all")}
          </Link>
          {activeStatuses.map((s) => {
            const cfg = JOB_STATUS_CONFIG[s as keyof typeof JOB_STATUS_CONFIG];
            return (
              <Link
                key={s}
                href={`/owner/jobs?status=${s}${search ? `&search=${search}` : ""}`}
                className={`px-3 py-1.5 rounded-full text-xs font-600 border transition-colors ${
                  status === s
                    ? `${cfg.bg} ${cfg.color} border-current`
                    : "border-gray-300 text-mist hover:border-gray-400"
                }`}
              >
                {cfg.label}
              </Link>
            );
          })}
        </div>
      )}

      {/* Uninvoiced callout */}
      {showInvoiceCta && (() => {
        const uninvoiced = jobs.filter((j) => !j.invoice_id);
        return uninvoiced.length > 0 ? (
          <div className="mb-4 bg-amber/10 border border-amber/30 rounded-xl px-4 py-3">
            <p className="text-sm font-600 text-forge">
              {uninvoiced.length} job{uninvoiced.length !== 1 ? "s" : ""} completed — click <strong>Invoice →</strong> on any row to bill it
            </p>
          </div>
        ) : null;
      })()}

      {/* List */}
      <div className="surface-card overflow-hidden">
        {!jobs.length ? (
          <div className="p-12 text-center">
            <p className="text-mist text-sm mb-3">{t("jobs.noJobsFound")}</p>
            {!showPast && (
              <Link href="/owner/jobs/new" className="text-amber hover:underline text-sm">
                {t("jobs.createJob")} →
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="divide-y divide-gray-100 md:hidden">
              {jobs.map((job) => {
                const statusCfg = JOB_STATUS_CONFIG[job.status as keyof typeof JOB_STATUS_CONFIG];
                const priorityCfg = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG];
                const needsInvoice = job.status === "completed" && !job.invoice_id;
                return (
                  <Link
                    key={job.id}
                    href={`/owner/jobs/${job.id}`}
                    className={`block p-4 space-y-2 ${needsInvoice ? "bg-amber/5" : "bg-white"} hover:bg-gray-50 transition-colors`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-700 text-forge line-clamp-1">{job.title}</p>
                        <p className="text-xs text-mist mt-0.5">{job.properties?.name || "—"}</p>
                        {job.scheduled_date && (
                          <p className="text-xs text-mist mt-0.5">{formatDate(job.scheduled_date)}</p>
                        )}
                        <span className={`badge mt-1 ${priorityCfg.bg} ${priorityCfg.color}`}>{priorityCfg.label}</span>
                      </div>
                      <span className={`badge ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="w-full text-sm" role="grid" aria-label="Jobs list">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <SortTh col="title" label={t("jobs.jobColumn")} sort={sort} sortDir={sortDir} status={status} search={search} />
                    <th scope="col" className="text-left px-4 py-3 font-600 text-mist text-xs uppercase tracking-wider">{t("jobs.propertyColumn")}</th>
                    <SortTh col="scheduled_date" label={t("jobs.scheduledColumn")} sort={sort} sortDir={sortDir} status={status} search={search} />
                    <SortTh col="status" label={t("jobs.statusColumn")} sort={sort} sortDir={sortDir} status={status} search={search} />
                    {showInvoiceCta && <th scope="col" className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {jobs.map((job) => {
                    const statusCfg = JOB_STATUS_CONFIG[job.status as keyof typeof JOB_STATUS_CONFIG];
                    const priorityCfg = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG];
                    const needsInvoice = job.status === "completed" && !job.invoice_id;
                    return (
                      <tr
                        key={job.id}
                        className={`relative hover:bg-gray-50 transition-colors ${needsInvoice ? "bg-amber/5" : ""}`}
                      >
                        <td className="px-4 py-3">
                          {/* Full-row click overlay */}
                          <Link
                            href={`/owner/jobs/${job.id}`}
                            className="font-600 text-forge line-clamp-1 after:absolute after:inset-0 after:content-['']"
                          >
                            {job.title}
                          </Link>
                          <span className={`ml-2 badge ${priorityCfg.bg} ${priorityCfg.color} hidden sm:inline`}>
                            {priorityCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-mist">{job.properties?.name || "—"}</td>
                        <td className="px-4 py-3 text-mist">
                          {job.scheduled_date ? formatDate(job.scheduled_date) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`badge ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
                        </td>
                        {showInvoiceCta && (
                          <td className="px-4 py-3 text-right relative z-10">
                            {needsInvoice ? (
                              <Link
                                href={`/owner/invoices/new?job=${job.id}`}
                                className="inline-flex items-center gap-1 bg-amber hover:bg-amber-dark text-forge font-display font-700 px-3 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap"
                              >
                                Invoice →
                              </Link>
                            ) : job.invoice_id ? (
                              <Link
                                href={`/owner/invoices/${job.invoice_id}`}
                                className="text-xs text-mist hover:text-amber transition-colors"
                              >
                                View invoice
                              </Link>
                            ) : null}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pageCount > 1 && (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-100">
                <Link
                  href={`/owner/jobs?${new URLSearchParams({ ...(showPast ? { past: "1" } : {}), ...(status ? { status } : {}), ...(search ? { search } : {}), sort, sortDir, page: String(Math.max(1, page - 1)) })}`}
                  className={`text-sm font-600 ${page === 1 ? "text-gray-400 pointer-events-none" : "text-forge hover:text-amber"}`}
                >
                  ← {t("common.previous")}
                </Link>
                <p className="text-xs text-mist">{t("common.pageOf", { page, pageCount })}</p>
                <Link
                  href={`/owner/jobs?${new URLSearchParams({ ...(showPast ? { past: "1" } : {}), ...(status ? { status } : {}), ...(search ? { search } : {}), sort, sortDir, page: String(Math.min(pageCount, page + 1)) })}`}
                  className={`text-sm font-600 ${page === pageCount ? "text-gray-400 pointer-events-none" : "text-forge hover:text-amber"}`}
                >
                  {t("common.next")} →
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
