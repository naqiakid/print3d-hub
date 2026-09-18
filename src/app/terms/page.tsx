import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck, Scale, FileText, AlertCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Terms of Service | Qid3D Studio',
  description: 'Terms of service and customer agreements for custom 3D printing and e-commerce orders at Qid3D Studio (Ampang, Malaysia).',
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-orange-600 transition"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Home
      </Link>

      <div className="mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 mb-3">
          <Scale className="h-3.5 w-3.5" />
          Consumer Protection (E-Commerce) Regulations 2012
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Last updated: September 2026 · Operating in Ampang, Selangor, Malaysia
        </p>
      </div>

      <div className="prose prose-slate max-w-none space-y-8 text-sm leading-relaxed text-slate-700">
        {/* Operator Disclosure */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-3">
            <ShieldCheck className="h-5 w-5 text-orange-500" />
            1. Business & Operator Identity
          </h2>
          <p>
            In compliance with the <strong>Consumer Protection (Electronic Commerce Transactions) Regulations 2012</strong> and the <strong>Electronic Commerce Act 2006</strong> of Malaysia, this service is operated by:
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-slate-600">
            <li><strong>Trading Name:</strong> Qid3D Studio (also referred to as Qid 3D Printing / 3MF Studio)</li>
            <li><strong>Principal Location:</strong> Ampang, Selangor Darul Ehsan, Malaysia</li>
            <li><strong>Official Contact:</strong> WhatsApp Customer Service / Email</li>
            <li><strong>Service Scope:</strong> Additive manufacturing (FDM 3D printing), rapid prototyping, and custom 3D printed model sales</li>
          </ul>
        </section>

        {/* Custom 3D Printing Nature & Tolerances */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-3">
            2. Nature of 3D Printing & Dimensional Tolerances
          </h2>
          <p>
            3D printing is an additive layer-by-layer manufacturing process. By placing an order with Qid3D Studio, you acknowledge and agree that:
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1.5 text-slate-600">
            <li>
              <strong>Layer Lines & Surface Finish:</strong> Visible layer lines, seam lines, and micro-textures are natural characteristics of FDM (Fused Deposition Modeling) prints and do not constitute manufacturing defects.
            </li>
            <li>
              <strong>Dimensional Tolerances:</strong> Standard FDM printing achieves dimensional accuracy within <strong>±0.2mm to ±0.5mm</strong> depending on geometry, thermal shrinkage, and material (PLA, PETG, TPU). If you require critical engineering press-fit clearances, please notify us prior to slicing.
            </li>
            <li>
              <strong>Material Suitability:</strong>
              <ul className="list-circle pl-5 mt-1 space-y-1">
                <li><strong>PLA:</strong> Best for decorative figures, prototypes, desk items. Not recommended for prolonged direct sunlight or temperatures exceeding 55°C.</li>
                <li><strong>PETG:</strong> High-strength, UV and heat resistant up to ~75°C. Suitable for mechanical parts and automotive interiors.</li>
                <li><strong>TPU:</strong> Flexible, rubber-like Shore 95A material with high abrasion resistance.</li>
              </ul>
            </li>
          </ul>
        </section>

        {/* Intellectual Property & Safety Policy */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-3">
            3. Intellectual Property & Prohibited Items
          </h2>
          <p>
            When uploading 3D CAD files (STL, OBJ, 3MF) or requesting prints:
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1.5 text-slate-600">
            <li>You warrant that you own the intellectual property rights to the design or have obtained a valid commercial or non-commercial personal license from the original creator.</li>
            <li>
              <strong>Strict Safety Prohibition:</strong> We strictly decline any requests to print firearms, weapon components, receiver lower blanks, lock-picking tools, or any items prohibited under Malaysian law (Arms Act 1960). Any such orders will be immediately rejected and reported where required.
            </li>
          </ul>
        </section>

        {/* Pricing, Payment & Delivery */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-3">
            4. Pricing, Currency & Payment
          </h2>
          <p>
            All prices on Qid3D Studio are quoted in <strong>Ringgit Malaysia (MYR)</strong>.
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-slate-600">
            <li>Quotes are calculated based on raw filament consumption (weight in grams), machine run-time hours, setup calibration, and power overheads.</li>
            <li>Payment is required prior to commencing machine print jobs via approved Malaysian payment methods (DuitNow QR, FPX Online Banking, or approved card gateways).</li>
            <li>Orders exceeding standard lead times or requiring custom CAD design modifications will be confirmed via WhatsApp prior to print commencement.</li>
          </ul>
        </section>

        {/* Fulfillment & Shipping */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-3">
            5. Fulfillment, Shipping & Pickup
          </h2>
          <p>
            We offer two fulfillment methods:
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-slate-600">
            <li><strong>Self-Pickup:</strong> Available at designated pickup points in Ampang, Selangor. Exact location pin and pickup slot will be provided once print status reaches &apos;Ready for Pickup&apos;.</li>
            <li><strong>Courier Postage:</strong> Dispatched via reliable couriers (J&T Express, Pos Laju, Ninja Van, DHL eCommerce). Tracking numbers will be attached to your online tracking dashboard.</li>
          </ul>
        </section>

        {/* Governing Law */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-3">
            6. Governing Law & Jurisdiction
          </h2>
          <p>
            These terms shall be governed by and interpreted in accordance with the laws of <strong>Malaysia</strong>. Any disputes arising in connection with orders shall be subject to the exclusive jurisdiction of the Malaysian courts.
          </p>
        </section>
      </div>
    </div>
  )
}
