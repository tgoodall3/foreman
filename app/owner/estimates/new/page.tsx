"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";

interface LineItem { description: string; quantity: number; unit_price: number }

const inp = "w-full min-w-0 max-w-full border border-gray-300 rounded-lg px-3 py-2.5 sm:py-3 text-sm focus:outline-none focus:border-amber";

export default function NewEstimatePage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();

  const [pms, setPms] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [usePm, setUsePm] = useState(true);
  const [pmId, setPmId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taxRate, setTaxRate] = useState(0);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: "", quantity: 1, unit_price: 0 }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
      if (!profile) return;

      const [{ data: pmList }, { data: propList }] = await Promise.all([
        supabase.from("property_managers").select("id, full_name, email").eq("tenant_id", profile.tenant_id).order("full_name"),
        supabase.from("properties").select("id, name, property_manager_id").eq("tenant_id", profile.tenant_id).order("name"),
      ]);
      setPms(pmList ?? []);
      setProperties(propList ?? []);
      if (pmList?.length) setPmId(pmList[0].id);
    };
    load();
  }, [supabase]);

  const filteredProps = properties.filter((p) => !pmId || p.property_manager_id === pmId);

  const addLineItem = () => setLineItems((prev) => [...prev, { description: "", quantity: 1, unit_price: 0 }]);
  const removeLineItem = (i: number) => setLineItems((prev) => prev.filter((_, idx) => idx !== i));
  const updateLineItem = (i: number, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)));
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const taxAmount = Math.round((subtotal * taxRate) / 100 * 100) / 100;
  const total = subtotal + taxAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError(t("estimates.titleRequired")); return; }
    if (usePm && !pmId) { setError(t("estimates.selectPMRequired")); return; }
    if (!usePm && !clientName.trim()) { setError(t("estimates.clientNameRequired")); return; }
    if (lineItems.some((l) => !l.description.trim())) { setError(t("estimates.lineItemsRequired")); return; }

    setLoading(true); setError("");

    const res = await fetch("/api/estimates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usePm,
        propertyManagerId: usePm ? pmId : undefined,
        propertyId: propertyId || undefined,
        clientName: usePm ? undefined : clientName.trim(),
        clientEmail: usePm ? undefined : (clientEmail.trim() || undefined),
        clientPhone: usePm ? undefined : (clientPhone.trim() || undefined),
        title: title.trim(),
        description: description.trim() || undefined,
        lineItems: lineItems.map((l) => ({
          description: l.description,
          quantity: Number(l.quantity),
          unit_price: Number(l.unit_price),
        })),
        taxRate: taxRate || undefined,
        validUntil: validUntil || undefined,
        notes: notes.trim() || undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) { setError(data.error || t("estimates.createFailed")); setLoading(false); return; }
    router.push(`/owner/estimates/${data.estimateId}`);
  };

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  return (
    <div className="page-shell page-shell-tight">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/owner/estimates" className="text-mist hover:text-forge text-sm transition-colors">{t("estimates.title")}</Link>
        <span className="text-mist">/</span>
        <span className="text-sm text-forge">{t("estimates.newEstimateTitle")}</span>
      </div>
      <h1 className="page-title">{t("estimates.newEstimateTitle")}</h1>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="surface-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-display font-700 text-lg text-forge">{t("estimates.clientLabel")}</h2>
            <label className="flex items-center gap-2 text-sm text-forge font-600">
              <input
                type="checkbox"
                checked={usePm}
                onChange={(e) => {
                  const next = e.target.checked;
                  setUsePm(next);
                  if (next && pms[0]) setPmId(pms[0].id);
                }}
                className="rounded border-gray-300 text-amber focus:ring-amber"
              />
              {t("estimates.forPM")}
            </label>
          </div>

          {usePm ? (
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="pm" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">
                  {t("estimates.propertyManagerLabel")} *
                </label>
                <select id="pm" value={pmId} onChange={(e) => { setPmId(e.target.value); setPropertyId(""); }} className={inp}>
                  <option value="">{t("estimates.selectOption")}</option>
                  {pms.map((pm) => (
                    <option key={pm.id} value={pm.id}>{pm.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="property" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("estimates.propertyLabel")}</label>
                <select id="property" value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className={inp} disabled={!pmId}>
                  <option value="">{t("estimates.noneOption")}</option>
                  {filteredProps.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label htmlFor="client-name" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("estimates.clientNameLabel")} *</label>
                <input id="client-name" value={clientName} onChange={(e) => setClientName(e.target.value)} className={inp} placeholder={t("estimates.clientNamePlaceholder")} />
              </div>
              <div>
                <label htmlFor="client-email" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("estimates.clientEmailLabel")}</label>
                <input id="client-email" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className={inp} placeholder={t("estimates.clientEmailPlaceholder")} />
              </div>
              <div>
                <label htmlFor="client-phone" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("estimates.clientPhoneLabel")}</label>
                <input id="client-phone" type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className={inp} placeholder={t("estimates.clientPhonePlaceholder")} />
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-display font-700 text-lg text-forge">{t("estimates.detailsSection")}</h2>
          <div>
            <label htmlFor="title" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("estimates.titleLabel")} *</label>
            <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className={inp} placeholder={t("estimates.titlePlaceholder")} />
          </div>
          <div>
            <label htmlFor="desc" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("estimates.scopeOfWork")}</label>
            <textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inp + " resize-none"} placeholder={t("estimates.scopePlaceholder")} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="valid-until" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("estimates.validUntilInput")}</label>
              <input id="valid-until" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inp} />
            </div>
            <div>
              <label htmlFor="tax" className="block text-xs font-600 text-mist uppercase tracking-wider mb-1">{t("estimates.taxRateLabel")}</label>
              <input id="tax" type="number" value={taxRate || ""} onChange={(e) => setTaxRate(Number(e.target.value))} min="0" max="100" step="0.1" className={inp} placeholder="0" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-700 text-lg text-forge">{t("estimates.lineItemsSection")}</h2>
            <button type="button" onClick={addLineItem} className="text-sm text-amber hover:underline font-600">{t("estimates.addItem")}</button>
          </div>

          <div className="space-y-3">
            {lineItems.map((item, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                <div className="md:col-span-6">
                  {i === 0 && <p className="text-xs text-mist mb-1 uppercase tracking-wider font-600">{t("estimates.descriptionHeader")}</p>}
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateLineItem(i, "description", e.target.value)}
                    placeholder={t("estimates.itemPlaceholder")}
                    className={inp}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  {i === 0 && <p className="text-xs text-mist mb-1 uppercase tracking-wider font-600">{t("estimates.qty")}</p>}
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(i, "quantity", Number(e.target.value))}
                    min="1"
                    step="1"
                    className={inp}
                  />
                </div>
                <div className="md:col-span-3">
                  {i === 0 && <p className="text-xs text-mist mb-1 uppercase tracking-wider font-600">{t("estimates.unitPrice")}</p>}
                  <input
                    type="number"
                    value={item.unit_price || ""}
                    onChange={(e) => updateLineItem(i, "unit_price", Number(e.target.value))}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className={inp}
                  />
                </div>
                <div className="md:col-span-1 flex items-end justify-end pb-0.5">
                  {i === 0 && <p className="text-xs text-mist mb-1 uppercase tracking-wider font-600 invisible">x</p>}
                  {lineItems.length > 1 && (
                    <button type="button" onClick={() => removeLineItem(i)} className="text-mist hover:text-red-500 transition-colors p-2" aria-label="Remove item">×</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-gray-100 space-y-1 text-sm">
            <div className="flex justify-between text-mist">
              <span>{t("estimates.subtotal")}</span><span className="font-600">{fmt(subtotal)}</span>
            </div>
            {taxRate > 0 && (
              <div className="flex justify-between text-mist">
                <span>{t("estimates.taxLine", { rate: String(taxRate) })}</span><span className="font-600">{fmt(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-forge font-display font-800 text-lg pt-1 border-t border-gray-200 mt-1">
              <span>{t("estimates.totalColumn")}</span><span>{fmt(total)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <label htmlFor="notes" className="block text-xs font-600 text-mist uppercase tracking-wider mb-2">{t("estimates.notesClientLabel")}</label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inp + " resize-none"} placeholder={t("estimates.notesClientPlaceholder")} />
        </div>

        {error && <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        <div className="flex gap-3">
          <Link href="/owner/estimates" className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-600 hover:bg-gray-50 transition-colors">{t("common.cancel")}</Link>
          <button type="submit" disabled={loading || !title.trim() || (usePm && !pmId) || (!usePm && !clientName.trim())} className="flex-1 bg-amber hover:bg-amber-dark disabled:opacity-50 text-forge font-display font-700 py-2.5 rounded-lg text-base transition-colors min-h-[44px]">
            {loading ? t("estimates.creating") : t("estimates.createButton")}
          </button>
        </div>
      </form>
    </div>
  );
}
