import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'Getting started',
    body: [
      'Add at least one filament roll under Equipment & Filaments, so pricing and order tracking work correctly.',
      'Turn on availability from My Listing so customers can see and request from you.',
      'List a product in your catalog so customers can order something directly, no back-and-forth needed.',
      'Share your request link (also on My Listing) with customers — that’s how they reach you.',
    ],
  },
  {
    title: 'Job queue & quotes',
    body: [
      'Every new request lands on your Dashboard. Open it to see the model, notes, and any customisations the customer asked for.',
      'To send a quote: upload the sliced G-code file(s) for the job. Weight and print time are read automatically from the file — no typing needed.',
      'The price breakdown (filament, electricity, machine wear, waste, markup) fills in on its own from your cost settings. You can still edit the final price before sending.',
      'Status moves forward as you work the job: quoted → accepted → printing → done → collected. The customer sees each step on their tracking page.',
    ],
  },
  {
    title: 'Listing & pricing',
    body: [
      'Availability controls whether customers can see and request from you at all — toggle it off if you’re fully booked.',
      'Advanced tier lets customers choose infill % and wall count for a higher-quality (and higher-priced) print. Leave it off if you’d rather keep it simple.',
      'The pricing preview shows what a typical medium print would cost at each quality tier, using your real settings — use it to sanity-check your rates.',
    ],
  },
  {
    title: 'Equipment & filaments',
    body: [
      'Nozzle sizes, bed surfaces, and capabilities (supports, ironing, multi-colour, etc.) are shown to customers on your public listing — only tick what your printer can actually do.',
      'Each filament roll can optionally track remaining grams. Turn on "Track remaining quantity" and set how much is on the roll.',
      'Once tracked, grams are deducted automatically whenever a job using that filament is marked Done — no manual bookkeeping.',
      'A roll that hits 0g is automatically marked out of stock, and any catalog item that needs it is hidden from ordering until you restock.',
      'Machine usage (total print hours, completed jobs, filament used) is tracked automatically from your finished jobs.',
    ],
  },
  {
    title: 'Catalog',
    body: [
      'Add your best/most popular prints here so customers can order them directly, with customisations like text engraving, colour, size, or material.',
      'Categories (e.g. "Home Decor", "Keychains") group your products and let customers filter your catalog — optional, but helpful once you have more than a few items.',
      'An item automatically greys out and shows "Out of stock" if the filament it needs runs out — nothing to manage by hand.',
    ],
  },
  {
    title: 'Price calculator',
    body: [
      'A standalone tool for quick estimates — upload a G-code file for an exact cost, or pick a size and material for a rough one. Doesn’t create or send anything, just for your own reference.',
    ],
  },
  {
    title: 'Account settings',
    body: [
      'Change your password here. Your email and member-since date are shown for reference.',
    ],
  },
]

export default async function HelpPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/dashboard"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
      </Link>

      <h1 className="mb-2 text-2xl font-bold text-slate-900">Help & Guide</h1>
      <p className="mb-8 text-sm text-slate-500">
        A quick walkthrough of everything on your dashboard.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {SECTIONS.map((section) => (
          <div key={section.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-start">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">{section.title}</h2>
            <ul className="space-y-2">
              {section.body.map((line, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-600">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-orange-400" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
