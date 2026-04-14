"use client";

import { useState } from "react";

interface Props {
  properties: any[];
  tenantName: string;
}

export default function PortalForm({ properties, tenantName }: Props) {
  const [title, setTitle]               = useState("");
  const [description, setDescription]   = useState("");
  const [propertyId, setPropertyId]     = useState(properties[0]?.id || "");
  const [priority, setPriority]         = useState("normal");
  const [submitting, setSubmitting]     = useState(false);
  const [submitted, setSubmitted]       = useState(false);
  const [error, setError]               = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/portal/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        property_id: propertyId,
        title,
        description,
        priority,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to submit work order. Please try again.");
    } else {
      setSubmitted(true);
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h1 className="font-display font-800 text-2xl text-forge mb-2">Work Order Submitted</h1>
          <p className="text-mist text-sm mb-6">
            Your work order has been received by {tenantName}. You&apos;ll receive a confirmation email shortly.
          </p>
          <button
            onClick={() => { setSubmitted(false); setTitle(""); setDescription(""); setPriority("normal"); }}
            className="bg-forge text-white font-display font-700 px-6 py-2.5 rounded-lg text-sm hover:bg-forge-light transition-colors"
          >
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-forge px-4 py-4" role="banner">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <div className="w-8 h-8 bg-amber rounded flex items-center justify-center">
            <span className="font-display font-800 text-forge text-lg">F</span>
          </div>
          <div>
            <p className="font-display font-800 text-white text-lg leading-none tracking-wide">FOREMAN</p>
            <p className="text-mist text-xs">{tenantName}</p>
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-lg mx-auto p-4 py-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          {/* Greeting */}
          <div className="mb-6">
            <h1 className="font-display font-800 text-2xl text-forge">Submit Work Order</h1>
            <p className="text-mist text-sm mt-1">
              Hi {propertyManager.full_name} — fill out the form below and we&apos;ll get back to you shortly.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Property */}
            <div>
              <label htmlFor="property" className="block text-sm font-600 text-forge mb-1">
                Property <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <select
                id="property"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                required
                aria-required="true"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-amber min-h-[44px]"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {p.address}</option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-600 text-forge mb-1">
                Issue Title <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                aria-required="true"
                placeholder="e.g. Broken gate latch at Pool Area"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:border-amber"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-600 text-forge mb-1">
                Description <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                aria-required="true"
                rows={4}
                placeholder="Describe the issue in detail. Include location, what you've observed, and any safety concerns."
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm resize-none focus:border-amber"
              />
            </div>

            {/* Priority */}
            <fieldset>
              <legend className="block text-sm font-600 text-forge mb-2">Priority</legend>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "low",       label: "Low",       desc: "Non-urgent",       color: "border-gray-300 has-[:checked]:border-gray-500 has-[:checked]:bg-gray-50" },
                  { value: "normal",    label: "Normal",    desc: "Standard",         color: "border-gray-300 has-[:checked]:border-blue-400 has-[:checked]:bg-blue-50" },
                  { value: "urgent",    label: "Urgent",    desc: "Within 48hrs",     color: "border-gray-300 has-[:checked]:border-orange-400 has-[:checked]:bg-orange-50" },
                  { value: "emergency", label: "Emergency", desc: "Safety issue",     color: "border-gray-300 has-[:checked]:border-red-400 has-[:checked]:bg-red-50" },
                ].map((p) => (
                  <label
                    key={p.value}
                    className={`flex items-start gap-2 border-2 rounded-lg p-3 cursor-pointer transition-all ${p.color}`}
                  >
                    <input
                      type="radio"
                      name="priority"
                      value={p.value}
                      checked={priority === p.value}
                      onChange={() => setPriority(p.value)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-600 text-forge">{p.label}</p>
                      <p className="text-xs text-mist">{p.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </fieldset>

            {error && (
              <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !title.trim() || !description.trim()}
              className="w-full bg-amber hover:bg-amber-dark disabled:opacity-50 text-forge font-display font-700 py-3 rounded-lg text-base transition-colors min-h-[44px]"
            >
              {submitting ? "Submitting…" : "Submit Work Order"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-mist mt-4">
          Powered by Foreman · {tenantName}
        </p>
      </main>
    </div>
  );
}
