"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Props {
  tenantId:   string;
  tenantName: string;
}

type Step = "welcome" | "worker" | "pm" | "property" | "done";

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber";

export default function OnboardingWizard({ tenantId, tenantName }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");

  // Worker form
  const [workerName,     setWorkerName]     = useState("");
  const [workerEmail,    setWorkerEmail]    = useState("");
  const [workerPhone,    setWorkerPhone]    = useState("");
  const [workerPassword, setWorkerPassword] = useState("");
  const [workerDone,     setWorkerDone]     = useState(false);

  // PM form
  const [pmName,    setPmName]    = useState("");
  const [pmEmail,   setPmEmail]   = useState("");
  const [pmPhone,   setPmPhone]   = useState("");
  const [pmCompany, setPmCompany] = useState("");
  const [pmDone,    setPmDone]    = useState(false);

  // Property form
  const [propName,    setPropName]    = useState("");
  const [propAddress, setPropAddress] = useState("");
  const [propCity,    setPropCity]    = useState("");
  const [propState,   setPropState]   = useState("");
  const [propZip,     setPropZip]     = useState("");

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const inviteWorker = async () => {
    if (!workerName.trim() || !workerEmail.trim() || !workerPassword) {
      setError("Name, email, and password are required."); return;
    }
    setLoading(true); setError("");
    const res = await fetch("/api/workers/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, fullName: workerName, email: workerEmail, phone: workerPhone || undefined, password: workerPassword }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || "Failed to invite worker."); return; }
    setWorkerDone(true);
    setTimeout(() => setStep("pm"), 800);
  };

  const addPm = async () => {
    if (!pmName.trim() || !pmEmail.trim()) {
      setError("Name and email are required."); return;
    }
    setLoading(true); setError("");
    const res = await fetch("/api/properties/add-pm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, fullName: pmName, email: pmEmail, phone: pmPhone || undefined, company: pmCompany || undefined }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || "Failed to add property manager."); return; }
    setPmDone(true);
    setTimeout(() => setStep("property"), 800);
  };

  const addProperty = async () => {
    if (!propName || !propAddress || !propCity || !propState || !propZip) {
      setError("All fields are required."); return;
    }
    setLoading(true); setError("");
    const res = await fetch("/api/properties/add-property", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: tenantId,
        name: propName,
        address: propAddress,
        city: propCity,
        state: propState,
        zip: propZip,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || "Failed to add property."); return; }
    setStep("done");
  };

  // — Step: Welcome —
  if (step === "welcome") return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="font-display font-800 text-forge text-3xl">F</span>
          </div>
          <h1 className="font-display font-800 text-3xl text-forge">Welcome to Foreman</h1>
          <p className="text-mist mt-2">Let&apos;s get <strong>{tenantName}</strong> set up in 3 quick steps.</p>
        </div>

        <div className="space-y-3 mb-8">
          {[
            { num: "1", title: "Add your first worker", desc: "Someone who will do the work on the ground." },
            { num: "2", title: "Add a property manager", desc: "A client who will submit work orders and receive invoices." },
            { num: "3", title: "Link a property", desc: "So your PM can submit a work order right away." },
          ].map((item) => (
            <div key={item.num} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-4">
              <div className="w-8 h-8 bg-amber rounded-full flex items-center justify-center shrink-0">
                <span className="font-display font-800 text-forge text-sm">{item.num}</span>
              </div>
              <div>
                <p className="font-600 text-forge">{item.title}</p>
                <p className="text-sm text-mist mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setStep("worker")}
          className="w-full bg-amber hover:bg-amber-dark text-forge font-display font-700 py-3 rounded-xl text-base transition-colors"
        >
          Get Started →
        </button>
        <p className="text-center mt-4">
          <Link href="/owner" className="text-xs text-mist hover:text-forge transition-colors">
            Skip for now
          </Link>
        </p>
      </div>
    </div>
  );

  // — Step: Worker —
  if (step === "worker") return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <StepIndicator current={1} />
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-display font-800 text-2xl text-forge mb-1">Add your first worker</h2>
          <p className="text-mist text-sm mb-5">They&amp;apos;ll log in at <strong>/worker</strong> to see and manage their jobs.</p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Full Name *</label>
              <input type="text" value={workerName} onChange={(e) => setWorkerName(e.target.value)} className={inp} placeholder="Jane Smith" />
            </div>
            <div>
              <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Email *</label>
              <input type="email" value={workerEmail} onChange={(e) => setWorkerEmail(e.target.value)} className={inp} placeholder="jane@example.com" />
            </div>
            <div>
              <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Phone</label>
              <input type="tel" value={workerPhone} onChange={(e) => setWorkerPhone(e.target.value)} className={inp} placeholder="(555) 555-5555" />
            </div>
            <div>
              <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Temporary Password *</label>
              <input type="password" value={workerPassword} onChange={(e) => setWorkerPassword(e.target.value)} className={inp} placeholder="They can change this later" />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">{error}</p>}

          {workerDone && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-3 font-600">
              ✓ Worker added! Moving to next step…
            </p>
          )}

          <div className="flex gap-3 mt-5">
            <button onClick={() => setStep("pm")} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-600 hover:bg-gray-50 transition-colors">
              Skip
            </button>
            <button
              onClick={inviteWorker}
              disabled={loading || workerDone}
              className="flex-1 bg-amber hover:bg-amber-dark disabled:opacity-50 text-forge font-display font-700 py-2.5 rounded-xl text-sm transition-colors"
            >
              {loading ? "Adding…" : "Add Worker →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // — Step: Property Manager —
  if (step === "pm") return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <StepIndicator current={2} />
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-display font-800 text-2xl text-forge mb-1">Add a property manager</h2>
          <p className="text-mist text-sm mb-5">They&amp;apos;ll submit work orders and receive invoices via a secure portal link.</p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Full Name *</label>
              <input type="text" value={pmName} onChange={(e) => setPmName(e.target.value)} className={inp} placeholder="John Manager" />
            </div>
            <div>
              <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Email *</label>
              <input type="email" value={pmEmail} onChange={(e) => setPmEmail(e.target.value)} className={inp} placeholder="john@properties.com" />
            </div>
            <div>
              <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Phone</label>
              <input type="tel" value={pmPhone} onChange={(e) => setPmPhone(e.target.value)} className={inp} placeholder="(555) 555-5555" />
            </div>
            <div>
              <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Company</label>
              <input type="text" value={pmCompany} onChange={(e) => setPmCompany(e.target.value)} className={inp} placeholder="Acme Properties" />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">{error}</p>}

          {pmDone && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-3 font-600">
              ✓ Property manager added! Almost done…
            </p>
          )}

          <div className="flex gap-3 mt-5">
            <button onClick={() => setStep("property")} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-600 hover:bg-gray-50 transition-colors">
              Skip
            </button>
            <button
              onClick={addPm}
              disabled={loading || pmDone}
              className="flex-1 bg-amber hover:bg-amber-dark disabled:opacity-50 text-forge font-display font-700 py-2.5 rounded-xl text-sm transition-colors"
            >
              {loading ? "Adding…" : "Add Property Manager →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // — Step: Property —
  if (step === "property") return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <StepIndicator current={3} />
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-display font-800 text-2xl text-forge mb-1">Link your first property</h2>
          <p className="text-mist text-sm mb-5">This lets your PM submit their first work order immediately.</p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Name *</label>
              <input type="text" value={propName} onChange={(e) => setPropName(e.target.value)} className={inp} placeholder="River Oaks Apt 12" />
            </div>
            <div>
              <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">Address *</label>
              <input type="text" value={propAddress} onChange={(e) => setPropAddress(e.target.value)} className={inp} placeholder="123 Main St" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">City *</label>
                <input type="text" value={propCity} onChange={(e) => setPropCity(e.target.value)} className={inp} placeholder="Indianapolis" />
              </div>
              <div>
                <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">State *</label>
                <input type="text" value={propState} onChange={(e) => setPropState(e.target.value)} className={inp} placeholder="IN" />
              </div>
              <div>
                <label className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">ZIP *</label>
                <input type="text" value={propZip} onChange={(e) => setPropZip(e.target.value)} className={inp} placeholder="46201" />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">{error}</p>}

          <div className="flex gap-3 mt-5">
            <button onClick={() => setStep("done")} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-600 hover:bg-gray-50 transition-colors">
              Skip
            </button>
            <button
              onClick={addProperty}
              disabled={loading}
              className="flex-1 bg-amber hover:bg-amber-dark disabled:opacity-50 text-forge font-display font-700 py-2.5 rounded-xl text-sm transition-colors"
            >
              {loading ? "Adding…" : "Save property →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // — Step: Done —
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-display font-800 text-3xl text-forge mb-2">You&amp;apos;re all set!</h2>
        <p className="text-mist mb-8">
          {tenantName} is ready. Head to your dashboard or create your first job.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/owner"
            className="w-full bg-amber hover:bg-amber-dark text-forge font-display font-700 py-3 rounded-xl text-base transition-colors"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/owner/jobs/new"
            className="w-full border border-gray-300 text-forge font-600 py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors"
          >
            Create First Job
          </Link>
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-5">
      {[1, 2, 3].map((n) => (
        <div key={n} className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-700 ${
            n < current ? "bg-green-500 text-white" :
            n === current ? "bg-amber text-forge" : "bg-gray-200 text-mist"
          }`}>
            {n}
          </div>
          {n < 3 && <div className="w-8 h-px bg-gray-300" />}
        </div>
      ))}
    </div>
  );
}
