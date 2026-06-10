import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | AI Therapist",
  description: "Terms and conditions for using AI Therapist.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="text-sm text-green-400 hover:text-green-300 transition-colors"
        >
          ← Back to home
        </Link>

        <h1 className="mt-8 text-3xl font-bold">Terms of Service</h1>
        <p className="mt-2 text-gray-400 text-sm">Last updated: June 10, 2026</p>

        <div className="mt-10 space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              Acceptance of terms
            </h2>
            <p>
              By creating an account or using AI Therapist, you agree to these
              Terms of Service. If you do not agree, please do not use the
              service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              Nature of the service
            </h2>
            <p>
              AI Therapist provides AI-assisted mental health support. It is not
              a replacement for licensed professional care, diagnosis, or
              treatment. Always seek advice from a qualified healthcare provider
              for medical or mental health concerns.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              Your responsibilities
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Provide accurate account information</li>
              <li>Use the service in a lawful and respectful manner</li>
              <li>Do not attempt to misuse, disrupt, or reverse-engineer the platform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              Limitation of liability
            </h2>
            <p>
              AI Therapist is provided &quot;as is.&quot; We are not liable for
              decisions you make based on interactions with the service. In an
              emergency, contact local emergency services immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              Changes to these terms
            </h2>
            <p>
              We may update these terms from time to time. Continued use of the
              service after changes are posted constitutes acceptance of the
              updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Contact</h2>
            <p>
              Questions about these terms? Email{" "}
              <a
                href="mailto:support@aitherapy.com"
                className="text-green-400 hover:text-green-300 underline"
              >
                support@aitherapy.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
