"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/ToastContainer";
import { useLanguage } from "@/lib/i18n";

type Entry = {
  id: string;
  clocked_in_at: string;
  clocked_out_at: string | null;
  notes?: string | null;
};

type Request = {
  id: string;
  time_entry_id: string | null;
  requested_date: string;
  requested_clocked_in_at: string | null;
  requested_clocked_out_at: string | null;
  reason: string;
  status: "pending" | "approved" | "declined";
  created_at: string;
};

type Props = {
  weekStart: string;
  entries: Entry[];
  requests: Request[];
};

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function fmtWeekRange(startStr: string, endStr: string) {
  const start = new Date(startStr + "T00:00:00Z");
  const end   = new Date(endStr   + "T00:00:00Z");
  const month = start.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const endMonth = end.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const startDay = start.getUTCDate();
  const endDay   = end.getUTCDate();
  if (month === endMonth) return `${month} ${startDay} – ${endDay}`;
  return `${month} ${startDay} – ${endMonth} ${endDay}`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function hoursWorked(inAt: string, outAt: string | null) {
  if (!outAt) return null;
  return (new Date(outAt).getTime() - new Date(inAt).getTime()) / 3_600_000;
}

const STATUS_STYLES: Record<Request["status"], { bg: string; text: string }> = {
  pending:  { bg: "bg-amber/15 border-amber/40",  text: "text-amber-dark" },
  approved: { bg: "bg-green-50 border-green-200", text: "text-green-700" },
  declined: { bg: "bg-red-50 border-red-200",     text: "text-red-700" },
};

export default function Timesheet({ weekStart, entries, requests }: Props) {
  const { addToast } = useToast();
  const { t } = useLanguage();
  const [localRequests, setLocalRequests] = useState<Request[]>(requests);
  const [modalOpen, setModalOpen]         = useState(false);
  const [requestsOpen, setRequestsOpen]   = useState(false);
  const [selectedDate, setSelectedDate]   = useState(weekStart);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [inTime, setInTime]   = useState("");
  const [outTime, setOutTime] = useState("");
  const [reason, setReason]   = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const days      = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const prevWeek  = addDays(weekStart, -7);
  const nextWeek  = addDays(weekStart, 7);
  const pendingCount = localRequests.filter((r) => r.status === "pending").length;

  const today         = mounted ? new Date().toISOString().split("T")[0] : "";
  const isCurrentWeek = mounted ? weekStart === getMonday(new Date()) : true;

  const entriesByDate = useMemo(() => {
    const map: Record<string, Entry[]> = {};
    for (const e of entries) {
      const date = e.clocked_in_at.split("T")[0];
      if (!map[date]) map[date] = [];
      map[date].push(e);
    }
    return map;
  }, [entries]);

  const requestsByDate = useMemo(() => {
    const map: Record<string, Request[]> = {};
    for (const r of localRequests) {
      if (!map[r.requested_date]) map[r.requested_date] = [];
      map[r.requested_date].push(r);
    }
    return map;
  }, [localRequests]);

  useEffect(() => { setRequestsOpen(false); }, [weekStart]);

  if (!mounted) {
    return (
      <div className="p-4 max-w-3xl mx-auto space-y-3 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-40" />
        <div className="h-10 bg-gray-100 rounded-xl" />
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl" />
        ))}
      </div>
    );
  }

  const openModal = () => {
    const defaultDate = days.includes(today) ? today : weekStart;
    setSelectedDate(defaultDate);
    setSelectedEntryId(null);
    setInTime("");
    setOutTime("");
    setReason("");
    setError("");
    setModalOpen(true);
  };

  // When selected date changes in the modal, clear the entry selection
  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setSelectedEntryId(null);
  };

  const submit = async () => {
    setSaving(true);
    setError("");

    const requested_clocked_in_at  = inTime  ? `${selectedDate}T${inTime}:00Z`  : undefined;
    const requested_clocked_out_at = outTime ? `${selectedDate}T${outTime}:00Z` : undefined;

    const res = await fetch("/api/timesheets/change-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        time_entry_id: selectedEntryId ?? undefined,
        requested_date: selectedDate,
        requested_clocked_in_at,
        requested_clocked_out_at,
        reason,
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      addToast(data.error || t("timesheets.failedToSubmit"), "error");
      setError(data.error || t("timesheets.failedToSubmit"));
      return;
    }

    addToast(t("timesheets.requestSubmitted"), "success");
    setLocalRequests((prev) => [data.request as Request, ...prev]);
    setModalOpen(false);
  };

  const reqBadge = (req: Request | undefined) => {
    if (!req) return null;
    const s = STATUS_STYLES[req.status];
    const label = req.status === "pending" ? t("timesheets.pendingReview")
                : req.status === "approved" ? t("timesheets.approved")
                : t("timesheets.declined");
    return (
      <span className={`inline-block text-[11px] font-700 px-2 py-0.5 rounded border ${s.bg} ${s.text}`}>
        {label}
      </span>
    );
  };

  const dateEntries = entriesByDate[selectedDate] ?? [];

  return (
    <div className="p-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="font-display font-800 text-2xl text-forge">{t("timesheets.myTimesheet")}</h1>

        <div className="mt-3 flex items-center gap-2">
          {/* Week navigation pill */}
          <div className="flex items-center justify-between gap-1 bg-white border border-gray-200 rounded-xl px-2 py-1.5 flex-1">
            <a
              href={`/worker/timesheets?week=${prevWeek}`}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label={t("timesheets.previousWeek")}
            >
              <svg className="w-4 h-4 text-forge" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <div className="text-center flex-1">
              <p className="font-display font-700 text-forge text-sm leading-tight">
                {fmtWeekRange(weekStart, addDays(weekStart, 6))}
              </p>
              {!isCurrentWeek && (
                <a href="/worker/timesheets" className="text-[11px] text-amber font-600 hover:underline">
                  {t("timesheets.thisWeek")}
                </a>
              )}
            </div>
            <a
              href={`/worker/timesheets?week=${nextWeek}`}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label={t("timesheets.nextWeek")}
            >
              <svg className="w-4 h-4 text-forge" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>

          {/* Requests badge — always visible so nav row stays stable */}
          <button
            type="button"
            onClick={() => setRequestsOpen(true)}
            className="relative p-2.5 bg-white border border-gray-200 rounded-xl hover:border-gray-400 transition-colors"
            aria-label={t("timesheets.myRequests")}
          >
            <svg className="w-4 h-4 text-forge" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-800 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* FAB — floats above the bottom nav */}
      <button
        type="button"
        onClick={openModal}
        className="fixed bottom-20 right-4 z-40 inline-flex items-center gap-2 px-4 py-3 bg-amber text-forge font-display font-700 text-sm rounded-2xl shadow-lg hover:bg-amber-dark active:scale-95 transition-all"
      >
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        {t("timesheets.requestChange")}
      </button>

      {/* Day cards */}
      <div className="space-y-3">
        {days.map((date) => {
          const dayEntries  = entriesByDate[date] ?? [];
          const dayRequests = requestsByDate[date] ?? [];
          const dayReq      = dayRequests.find((r) => !r.time_entry_id) ?? dayRequests[0];
          const totalHours  = dayEntries.reduce((s, e) => s + (hoursWorked(e.clocked_in_at, e.clocked_out_at) ?? 0), 0);

          return (
            <div
              key={date}
              className={`bg-white border rounded-xl p-4 ${date === today ? "border-amber" : "border-gray-200"}`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-xs uppercase tracking-wider text-mist font-600">{fmtDate(date)}</p>
                {dayReq && reqBadge(dayReq)}
              </div>
              <p className="font-display font-800 text-lg text-forge mb-3">
                {totalHours > 0 ? `${totalHours.toFixed(1)}h` : "–"}
              </p>

              {dayEntries.length === 0 ? (
                <p className="text-xs text-mist">{t("timesheets.noPunches")}</p>
              ) : (
                <div className="space-y-2">
                  {dayEntries.map((e) => {
                    const req = dayRequests.find((r) => r.time_entry_id === e.id);
                    return (
                      <div
                        key={e.id}
                        className={`rounded-lg border px-3 py-2 ${req ? STATUS_STYLES[req.status].bg : "border-gray-100"}`}
                      >
                        <p className="font-600 text-sm text-forge">
                          {fmtTime(e.clocked_in_at)} – {e.clocked_out_at ? fmtTime(e.clocked_out_at) : t("timesheets.openEntry")}
                        </p>
                        {e.notes && <p className="text-xs text-mist mt-0.5">{e.notes}</p>}
                        {req && <div className="mt-1">{reqBadge(req)}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Request change modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalOpen(false)} aria-hidden="true" />
          <div className="relative bg-white rounded-t-2xl sm:rounded-xl shadow-2xl max-w-md w-full p-5 border border-gray-200">
            <h2 className="font-display font-700 text-lg text-forge mb-1">{t("timesheets.requestAChange")}</h2>
            <p className="text-xs text-mist mb-4">{t("timesheets.requestSentNote")}</p>

            <div className="space-y-3">
              {/* Day selector */}
              <div>
                <label className="block text-xs font-700 text-mist uppercase tracking-wider mb-1">{t("jobs.date")}</label>
                <select
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  {days.map((d) => (
                    <option key={d} value={d}>{fmtDate(d)}</option>
                  ))}
                </select>
              </div>

              {/* Entry selector — only shown when the day has punches */}
              {dateEntries.length > 0 && (
                <div>
                  <label className="block text-xs font-700 text-mist uppercase tracking-wider mb-1">
                    Time entry
                  </label>
                  <select
                    value={selectedEntryId ?? ""}
                    onChange={(e) => setSelectedEntryId(e.target.value || null)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">General / add missing punch</option>
                    {dateEntries.map((e) => (
                      <option key={e.id} value={e.id}>
                        {fmtTime(e.clocked_in_at)} – {e.clocked_out_at ? fmtTime(e.clocked_out_at) : t("timesheets.openEntry")}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-700 text-mist uppercase tracking-wider mb-1">{t("timesheets.clockIn")}</label>
                  <input
                    type="time"
                    value={inTime}
                    onChange={(e) => setInTime(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-700 text-mist uppercase tracking-wider mb-1">{t("timesheets.clockOut")}</label>
                  <input
                    type="time"
                    value={outTime}
                    onChange={(e) => setOutTime(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-700 text-mist uppercase tracking-wider mb-1">{t("timesheets.whatNeedsToChange")}</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder={t("timesheets.changePlaceholder")}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>

            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setModalOpen(false)}
                className="px-3 py-2 text-sm font-600 text-mist hover:text-forge"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={submit}
                disabled={saving || reason.trim().length < 5}
                className="bg-amber text-forge font-display font-700 px-4 py-2 rounded-lg text-sm disabled:opacity-50 hover:bg-amber-dark transition-colors"
              >
                {saving ? t("timesheets.sending") : t("timesheets.sendToOwner")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* My requests panel */}
      {requestsOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setRequestsOpen(false)} aria-hidden="true" />
          <div className="relative bg-white rounded-t-2xl sm:rounded-xl shadow-2xl max-w-md w-full p-5 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-700 text-lg text-forge">{t("timesheets.requestsThisWeek")}</h2>
              <button onClick={() => setRequestsOpen(false)} className="text-sm text-mist hover:text-forge">{t("common.close")}</button>
            </div>
            {localRequests.length === 0 ? (
              <p className="text-sm text-mist">{t("timesheets.noRequestsThisWeek")}</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-auto pr-1">
                {localRequests.map((r) => (
                  <div key={r.id} className="border border-gray-100 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-700 text-forge">{fmtDate(r.requested_date)}</p>
                      <span className={`text-[11px] font-700 px-2 py-0.5 rounded border ${STATUS_STYLES[r.status].bg} ${STATUS_STYLES[r.status].text}`}>
                        {r.status === "pending" ? t("timesheets.pendingReview") : r.status === "approved" ? t("timesheets.approved") : t("timesheets.declined")}
                      </span>
                    </div>
                    <p className="text-xs text-mist mt-1">
                      {r.requested_clocked_in_at ? fmtTime(r.requested_clocked_in_at) : "—"} – {r.requested_clocked_out_at ? fmtTime(r.requested_clocked_out_at) : "—"}
                    </p>
                    <p className="text-xs text-steel mt-1 leading-snug">{r.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split("T")[0];
}
