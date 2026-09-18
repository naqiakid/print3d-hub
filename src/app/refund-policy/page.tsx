import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Refund & Reprint Policy | Qid3D Studio',
  description: 'Reprint guarantees and refund policies for custom 3D printing and catalog orders at Qid3D Studio.',
}

export default function RefundPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-orange-600 transition"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Home
      </Link>

      <div className="mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 mb-3">
          <RefreshCw className="h-3.5 w-3.5" />
          Quality & Reprint Guarantee
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Refund &amp; Reprint Policy
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Last updated: September 2026 · Fair, transparent policies for custom manufacturing
        </p>
      </div>

      <div className="prose prose-slate max-w-none space-y-8 text-sm leading-relaxed text-slate-700">
        {/* Custom Printing Reality */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            1. Nature of Custom 3D Printed Items
          </h2>
          <p>
            Unlike mass-produced consumer retail goods, custom 3D printed models are fabricated specifically to your digital 3D model, selected filament material, color, and density.
          </p>
          <div className="mt-3 rounded-xl bg-amber-50/70 p-4 border border-amber-200 text-xs text-amber-900">
            <strong>Cancellation Notice:</strong> You may cancel your order and receive a 100% refund at any time <strong>before</strong> the print job has started printing on the physical machine (status: &apos;New&apos; or &apos;Quoted&apos;). Once physical printing has commenced (status: &apos;Printing&apos;), materials and machine run-time are irrevocably consumed, and cancellations cannot be accepted.
          </div>
        </section>

        {/* Reprint Guarantee */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-5 w-5 text-teal-500" />
            2. 100% Free Reprint Guarantee
          </h2>
          <p>
            At Qid3D Studio, we stand behind the structural integrity of our prints. We will provide a <strong>free reprint</strong> or a <strong>full refund</strong> under the following circumstances:
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-2 text-slate-600">
            <li>
              <strong>Damaged During Courier Transit:</strong> If your parcel was crushed or cracked during delivery by courier, please contact us within 48 hours of delivery with photos of the damaged packaging and part.
            </li>
            <li>
              <strong>Manufacturing Flaws / Layer Separation:</strong> Delamination, incomplete extrusion, or severe print artifacts caused by machine calibration error.
            </li>
            <li>
              <strong>Incorrect Filament or Color:</strong> If the delivered item was printed in the wrong material (e.g. PLA instead of PETG) or a completely different color than ordered.
            </li>
            <li>
              <strong>Dimensional Inaccuracy Beyond Tolerance:</strong> If an engineering part deviates by more than <strong>±0.5mm</strong> from the dimensions of the provided STL file.
            </li>
          </ul>
        </section>

        {/* Situations Not Covered */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-3">
            3. Exceptions (Issues Not Covered)
          </h2>
          <p>
            Free reprints and refunds cannot be provided for:
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1.5 text-slate-600">
            <li><strong>CAD Design Flaws:</strong> Inherent structural weaknesses in the original 3D file submitted by the client (such as walls under 0.8mm, unjoined floating meshes, or incorrect scale exported in inches instead of millimeters).</li>
            <li><strong>Incorrect Measurements:</strong> If the client measured their target socket/bolt incorrectly and the print matches the provided CAD dimensions accurately.</li>
            <li><strong>Thermal Abuse:</strong> Warping of PLA parts left inside hot vehicles under Malaysian midday sun (temperatures inside parked cars routinely exceed 65°C; please select PETG for automotive use).</li>
            <li><strong>Minor Cosmetic Layer Lines:</strong> Normal FDM layer lines and seam lines are inherent to 3D printing and do not count as defects.</li>
          </ul>
        </section>

        {/* How to Claim */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-3">
            <ShieldCheck className="h-5 w-5 text-orange-500" />
            4. How to Submit a Claim
          </h2>
          <p>
            To request a reprint or refund:
          </p>
          <ol className="mt-2 list-decimal pl-5 space-y-2 text-slate-600">
            <li>Open WhatsApp and message our studio with your <strong>Order ID / Tracking Link</strong>.</li>
            <li>Attach 2–3 clear photos or a short video demonstrating the issue or damage.</li>
            <li>We will review your claim within <strong>24 hours</strong>. If approved, your reprint will be prioritized immediately on the print bed, or your refund will be transferred back via DuitNow within 3 business days.</li>
          </ol>
        </section>
      </div>
    </div>
  )
}
