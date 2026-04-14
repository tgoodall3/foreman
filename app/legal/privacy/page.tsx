import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Foreman collects, uses, and protects your information.",
};

export default function PrivacyPolicyPage() {
  const updated = "April 14, 2025";

  return (
    <main className="min-h-screen bg-forge text-chalk">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-10">
          <Link href="/" className="inline-flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-amber rounded flex items-center justify-center">
              <span className="font-display font-800 text-forge text-lg">F</span>
            </div>
            <span className="font-display font-800 text-white text-xl tracking-wide">FOREMAN</span>
          </Link>
          <h1 className="font-display font-800 text-white text-3xl mt-6 mb-2">Privacy Policy</h1>
          <p className="text-mist text-sm">Last updated: {updated}</p>
        </div>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 text-mist leading-relaxed">
          <section>
            <h2 className="text-white font-700 text-lg mb-3">1. Who we are</h2>
            <p>
              Foreman is a field service management platform for general contractors. References to
              &quot;Foreman&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot; refer to the operator of this
              service. References to &quot;you&quot; refer to contractors, workers, or property managers
              using the platform.
            </p>
          </section>

          <section>
            <h2 className="text-white font-700 text-lg mb-3">2. Information we collect</h2>
            <p>We collect information you provide directly:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Account information: name, email address, phone number</li>
              <li>Business information: company name, job details, work orders</li>
              <li>Payment information: processed by Stripe — we never store card numbers</li>
              <li>Communications: messages, work order notes, comments</li>
              <li>Photos: images uploaded to jobs or work orders</li>
            </ul>
            <p className="mt-3">We also collect information automatically:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Log data: IP addresses, browser type, pages visited</li>
              <li>Error reports: sent to Sentry, which may include device and session information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-700 text-lg mb-3">3. How we use your information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide and operate the Foreman service</li>
              <li>Send transactional emails (work order updates, invoices, estimates)</li>
              <li>Process payments through Stripe</li>
              <li>Monitor and fix errors through Sentry</li>
              <li>Respond to support requests</li>
            </ul>
            <p className="mt-3">We do not sell your data to third parties.</p>
          </section>

          <section>
            <h2 className="text-white font-700 text-lg mb-3">4. Third-party services</h2>
            <p>We use the following third-party processors:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><span className="text-chalk">Supabase</span> — database and authentication</li>
              <li><span className="text-chalk">Stripe</span> — payment processing</li>
              <li><span className="text-chalk">Resend</span> — transactional email delivery</li>
              <li><span className="text-chalk">Sentry</span> — error monitoring (may collect IP addresses and session data)</li>
              <li><span className="text-chalk">Vercel</span> — hosting and infrastructure</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-700 text-lg mb-3">5. Data retention</h2>
            <p>
              We retain your data for as long as your account is active. If you close your account,
              we will delete your personal data within 30 days, except where we are required to
              retain it by law (e.g. billing records).
            </p>
          </section>

          <section>
            <h2 className="text-white font-700 text-lg mb-3">6. Your rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Export your data in a portable format</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at the email address on file for your account.
            </p>
          </section>

          <section>
            <h2 className="text-white font-700 text-lg mb-3">7. Security</h2>
            <p>
              We use industry-standard security practices including encrypted connections (TLS),
              row-level security on our database, and access controls that limit which personnel
              can access your data. No method of transmission over the internet is 100% secure,
              and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-white font-700 text-lg mb-3">8. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. We will notify active users of material
              changes by email. Continued use of Foreman after changes take effect constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-white font-700 text-lg mb-3">9. Contact</h2>
            <p>
              Questions about this policy? Contact us through your account settings or reach out
              directly at the email address associated with your Foreman account.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-steel flex gap-6 text-sm">
          <Link href="/legal/terms" className="text-amber hover:underline">Terms of Service</Link>
          <Link href="/login" className="text-mist hover:text-chalk">Sign in</Link>
        </div>
      </div>
    </main>
  );
}
