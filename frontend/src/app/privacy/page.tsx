import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | AI Therapist",
  description: "How AI Therapist collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="text-sm text-green-400 hover:text-green-300 transition-colors"
        >
          ← Back to home
        </Link>

        <h1 className="mt-8 text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-gray-400 text-sm">Last updated: June 10, 2026</p>

        <div className="mt-10 space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              Your privacy matters
            </h2>
            <p>
              AI Therapist is designed to support your mental health in a safe,
              confidential environment. This policy explains what information we
              collect, how we use it, and the choices you have.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              Information we collect
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Account details such as your name and email address</li>
              <li>Session transcripts and voice interactions during therapy calls</li>
              <li>Usage data to improve the service and ensure reliability</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              How we use your information
            </h2>
            <p>
              We use your data to provide therapy sessions, generate session
              summaries and reports, maintain your account, and improve the
              quality of the service. We do not sell your personal information
              to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              Security
            </h2>
            <p>
              Conversations are encrypted in transit and stored securely. Access
              to your data is restricted to authorized systems and personnel
              required to operate the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              Your rights
            </h2>
            <p>
              You may request access to, correction of, or deletion of your
              personal data by contacting us at{" "}
              <a
                href="mailto:support@aitherapy.com"
                className="text-green-400 hover:text-green-300 underline"
              >
                support@aitherapy.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              Crisis situations
            </h2>
            <p>
              AI Therapist is not a substitute for emergency services. If you are
              in immediate danger, please call your local emergency number or a
              crisis hotline.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
