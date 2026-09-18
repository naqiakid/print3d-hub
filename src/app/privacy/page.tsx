import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Lock, ShieldCheck, Database, EyeOff } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Privacy Policy (PDPA Notice) | Qid3D Studio',
  description: 'PDPA 2010 compliant Privacy Policy explaining how Qid3D Studio protects customer data and intellectual property.',
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-orange-600 transition"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Home
      </Link>

      <div className="mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 mb-3">
          <Lock className="h-3.5 w-3.5" />
          Personal Data Protection Act (PDPA) 2010 Notice
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Last updated: September 2026 · Committed to your privacy and design confidentiality
        </p>
      </div>

      <div className="prose prose-slate max-w-none space-y-8 text-sm leading-relaxed text-slate-700">
        {/* Commitment */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-3">
            <ShieldCheck className="h-5 w-5 text-orange-500" />
            1. Personal Data Protection Act 2010 Compliance
          </h2>
          <p>
            Qid3D Studio respects your privacy and is committed to complying with the <strong>Personal Data Protection Act 2010 (PDPA)</strong> of Malaysia. This Privacy Policy informs you how we collect, process, manage, and safeguard your personal details and 3D files.
          </p>
        </section>

        {/* Data Collected */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-3">
            <Database className="h-5 w-5 text-blue-500" />
            2. What Information We Collect
          </h2>
          <p>When you submit a 3D print request or purchase a catalog item, we may collect:</p>
          <ul className="mt-2 list-disc pl-5 space-y-1.5 text-slate-600">
            <li><strong>Identification &amp; Contact:</strong> Your full name, mobile/WhatsApp phone number, and email address.</li>
            <li><strong>Delivery Information:</strong> Physical shipping address (for courier dispatch) or preferred pickup timing (for Ampang self-pickup).</li>
            <li><strong>Design Assets:</strong> 3D CAD files (STL, OBJ, 3MF, STEP) and custom text instructions for personalized models.</li>
            <li><strong>Transaction Records:</strong> Order reference ID, payment confirmation status, and courier tracking numbers.</li>
          </ul>
        </section>

        {/* Intellectual Property Protection */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-3">
            <EyeOff className="h-5 w-5 text-teal-500" />
            3. CAD File Confidentiality &amp; IP Protection
          </h2>
          <p>
            We treat your custom digital 3D models with strict confidentiality:
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1.5 text-slate-600">
            <li>Your uploaded 3D files are used <strong>exclusively</strong> to slice and fabricate your physical order.</li>
            <li>We <strong>never</strong> re-sell, redistribute, share, or upload your proprietary CAD files to any public repository (Thingiverse, Printables, MakerWorld) without your explicit permission.</li>
            <li>We do not print duplicate copies of your bespoke prototypes for other customers.</li>
          </ul>
        </section>

        {/* Data Sharing */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-3">
            4. Disclosure to Third Parties
          </h2>
          <p>
            We strictly do not sell, rent, or trade your personal data to marketing brokers. Personal details are disclosed only to:
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1.5 text-slate-600">
            <li><strong>Logistics Couriers:</strong> Delivery name, shipping address, and recipient phone number shared with authorized delivery partners (such as J&amp;T Express, Pos Laju, Ninja Van, or GrabExpress) to fulfill delivery.</li>
            <li><strong>Legal Requirements:</strong> Law enforcement authorities if mandated by Malaysian judicial warrants.</li>
          </ul>
        </section>

        {/* Data Retention & Rights */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-3">
            5. Your Rights &amp; File Deletion
          </h2>
          <p>
            Under the PDPA, you retain the right to:
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1.5 text-slate-600">
            <li>Request a copy of your personal data stored on our servers.</li>
            <li>Request immediate deletion of your contact records and CAD files from our storage once an order is delivered and accepted.</li>
            <li>To exercise your privacy rights, simply contact us directly via WhatsApp or email with your Order ID.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
