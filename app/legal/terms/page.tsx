import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing your use of the Foreman platform.",
};

export default function TermsOfServicePage() {
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
          <h1 className="font-display font-800 text-white text-3xl mt-6 mb-2">Terms of Service</h1>
          <p className="text-mist text-sm">Last updated: {updated}</p>
        </div>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 text-mist leading-relaxed">
          <section>
            <h2 className="text-white font-700 text-lg mb-3">1. Acceptance of terms</h2>
            <p>
              By creating an account or using Foreman, you agree to these Terms of Service. If you
              do not agree, do not use the service. These terms apply to all users including
              contractors (owners), workers, and property managers.
            </p>
          </section>

          <section>
            <h2 className="text-white font-700 text-lg mb-3">2. Description of service</h2>
            <p>
              Foreman provides field service management software for general contractors, including
              tools for job management, invoicing, estimates, worker coordination, and property
              manager communication.
            </p>
          </section>

          <section>
            <h2 className="text-white font-700 text-lg mb-3">3. Accounts</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials.
              You are responsible for all activity that occurs under your account. Notify us
              immediately of any unauthorized use. You must be at least 18 years old to create
              an account.
            </p>
          </section>

          <section>
            <h2 className="text-white font-700 text-lg mb-3">4. Subscription and billing</h2>
            <p>
              Foreman offers a free trial period followed by a paid subscription. Billing is
              processed through Stripe. Subscriptions renew automatically unless cancelled.
              You may cancel at any time through your account settings. Refunds are handled
              on a case-by-case basis — contact us within 7 days of a charge if you believe
              it was in error.
            </p>
          </section>

          <section>
            <h2 className="text-white font-700 text-lg mb-3">5. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Use Foreman for any unlawful purpose</li>
              <li>Upload malicious files, spam, or harmful content</li>
              <li>Attempt to gain unauthorized access to other accounts or systems</li>
              <li>Resell or sublicense access to Foreman without written permission</li>
              <li>Scrape or extract data from the platform in bulk</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-700 text-lg mb-3">6. Your content</h2>
            <p>
              You retain ownership of content you upload (photos, documents, notes). By uploading
              content, you grant us a limited license to store and display it as necessary to
              provide the service. We do not claim ownership of your business data.
            </p>
          </section>

          <section>
            <h2 className="text-white font-700 text-lg mb-3">7. Availability and changes</h2>
            <p>
              We aim for high availability but do not guarantee uninterrupted service. We reserve
              the right to modify, suspend, or discontinue features with reasonable notice. We
              will not be liable for any downtime or data loss caused by circumstances outside
              our reasonable control.
            </p>
          </section>

          <section>
            <h2 className="text-white font-700 text-lg mb-3">8. Limitation of liability</h2>
            <p>
              To the fullest extent permitted by law, Foreman is provided &quot;as is&quot; without
              warranty. We are not liable for indirect, incidental, or consequential damages arising from
              your use of the service. Our total liability for any claim shall not exceed the
              amount you paid us in the 3 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-white font-700 text-lg mb-3">9. Termination</h2>
            <p>
              We may suspend or terminate accounts that violate these terms, without prior notice
              in serious cases. You may terminate your account at any time through account settings.
              Upon termination, your data will be deleted within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-white font-700 text-lg mb-3">10. Changes to terms</h2>
            <p>
              We may update these terms from time to time. We will notify active users of material
              changes by email at least 14 days before they take effect. Continued use after that
              date constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-white font-700 text-lg mb-3">11. Governing law</h2>
            <p>
              These terms are governed by the laws of the jurisdiction in which the operator is
              registered, without regard to conflict of law principles.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-steel flex gap-6 text-sm">
          <Link href="/legal/privacy" className="text-amber hover:underline">Privacy Policy</Link>
          <Link href="/login" className="text-mist hover:text-chalk">Sign in</Link>
        </div>
      </div>
    </main>
  );
}
