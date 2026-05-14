/**
 * E2E — Seed setup.
 *
 * Creates the minimum test data so data-dependent tests actually run:
 *
 *   1. Estimate → job          (change-order tests need a job)
 *   2. Invoice estimate → job → invoice  (invoice-send needs a PM-with-email invoice)
 *   3. Draft estimate          (estimate-convert test needs an unconverted estimate)
 *
 * Step 3 runs LAST so the draft estimate appears first in date-descending
 * lists — the convert test clicks the first estimate and needs it unconverted.
 *
 * Runs after auth.setup. Failures are non-fatal — tests skip gracefully.
 */
import { test as setup } from "@playwright/test";

setup("seed — estimates, job, and invoice", async ({ request }) => {
  // 1. Estimate → job  (change-order tests navigate to /owner/jobs)
  const jobEstimateRes = await request.post("/api/estimates", {
    data: {
      usePm: false,
      clientName: "E2E Job Client",
      clientEmail: "e2e-job@example.com",
      title: "E2E Seeded Job",
      lineItems: [{ description: "E2E Labor", quantity: 1, unit_price: 1000 }],
    },
  });
  if (jobEstimateRes.ok()) {
    const { estimateId } = await jobEstimateRes.json();
    const convertRes = await request.post(`/api/estimates/${estimateId}/convert`);
    if (!convertRes.ok()) {
      console.warn(`[seed] convert to job failed: ${convertRes.status()}`);
    }
  } else {
    console.warn(`[seed] estimate-for-job failed: ${jobEstimateRes.status()}`);
  }

  // 2. Invoice estimate → job → invoice
  // The invoice-send test sends to the first invoice; the PM must have an email
  // or the API returns 400 "Recipient email not provided".
  const invoiceEstimateRes = await request.post("/api/estimates", {
    data: {
      usePm: false,
      clientName: "E2E Invoice Client",
      clientEmail: "e2e-test@example.com",
      title: "E2E Seeded Invoice Job",
      lineItems: [{ description: "E2E Invoice Service", quantity: 1, unit_price: 500 }],
    },
  });
  if (invoiceEstimateRes.ok()) {
    const { estimateId, pmId } = await invoiceEstimateRes.json();
    const convertRes = await request.post(`/api/estimates/${estimateId}/convert`);
    if (convertRes.ok()) {
      const { jobId } = await convertRes.json();
      const due = new Date();
      due.setDate(due.getDate() + 30);
      const dueDate = due.toISOString().split("T")[0];
      const invoiceRes = await request.post("/api/invoices", {
        data: {
          jobId,
          propertyManagerId: pmId,
          dueDate,
          lineItems: [{ description: "E2E Invoice Service", quantity: 1, unit_price: 500 }],
        },
      });
      if (!invoiceRes.ok()) {
        console.warn(`[seed] invoice creation failed: ${invoiceRes.status()}`);
      }
    } else {
      console.warn(`[seed] convert for invoice failed: ${convertRes.status()}`);
    }
  } else {
    console.warn(`[seed] estimate-for-invoice failed: ${invoiceEstimateRes.status()}`);
  }

  // 3. Approved estimate — must be LAST so it appears first in date-descending lists.
  // The estimate-convert test needs an approved (not yet converted) estimate because
  // the "Convert to Job" button only renders when status === "approved".
  const draftRes = await request.post("/api/estimates", {
    data: {
      usePm: false,
      clientName: "E2E Estimate Client",
      clientEmail: "e2e-estimate@example.com",
      title: "E2E Seeded Estimate",
      lineItems: [{ description: "E2E Service", quantity: 2, unit_price: 250 }],
    },
  });
  if (draftRes.ok()) {
    const { estimateId } = await draftRes.json();
    const approveRes = await request.patch(`/api/estimates/${estimateId}/status`, {
      data: { status: "approved" },
    });
    if (!approveRes.ok()) {
      console.warn(`[seed] approve estimate failed: ${approveRes.status()}`);
    }
  } else {
    console.warn(`[seed] estimate creation failed: ${draftRes.status()}`);
  }
});
