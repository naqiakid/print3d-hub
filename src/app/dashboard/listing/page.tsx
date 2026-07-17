import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Shop, Printer, PrintProfile, FilamentMaterial } from '@/lib/types'
import { MATERIAL_LABELS } from '@/lib/types'
import AvailabilityToggle from '@/components/AvailabilityToggle'
import AdvancedToggle from '@/components/AdvancedToggle'
import ListingEditor from '@/components/ListingEditor'
import PhotoGalleryEditor from '@/components/PhotoGalleryEditor'
import CopyLinkButton from '@/components/CopyLinkButton'
import {
  calculateEstimate,
  DEFAULT_FILAMENT_COST_PER_KG,
  DEFAULT_ELECTRICITY_RATE,
  DEFAULT_MARKUP_PERCENT,
  DEFAULT_MACHINE_RATE,
  DEFAULT_WASTE_PERCENT,
} from '@/lib/pricing'

export default async function ListingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: shopData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (!shopData) redirect('/login')
  const shop = shopData as unknown as Shop

  const { data: printerRows } = await supabase
    .from('printers')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })

  if (!printerRows || printerRows.length === 0) redirect('/dashboard')
  const printers = printerRows as unknown as Printer[]
  const primaryPrinter = printers[0]

  // Fetch profiles for filament-cost preview (default infill/walls)
  const printerIds = printers.map((p) => p.id)
  const { data: profileData } = await supabase
    .from('print_profiles')
    .select('*')
    .in('printer_id', printerIds)
    .eq('is_active', true)

  const profiles = (profileData ?? []) as unknown as PrintProfile[]

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link
        href="/dashboard"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
      </Link>

      <h1 className="mb-6 text-2xl font-bold text-slate-900">My Listing</h1>

      {/* Availability toggle */}
      <div className="mb-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div>
          <p className="font-semibold text-slate-900">Availability</p>
          <p className="text-sm text-slate-500">
            {shop.available
              ? 'Customers can see and request from you'
              : 'Your listing is hidden from customers'}
          </p>
        </div>
        <AvailabilityToggle initial={shop.available} />
      </div>

      {/* Advanced tier toggle */}
      <div className="mb-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div>
          <p className="font-semibold text-slate-900">Advanced tier</p>
          <p className="text-sm text-slate-500">
            {shop.advanced_available
              ? 'Customers can customise infill % and wall count'
              : 'Only Basic quality shown to customers'}
          </p>
        </div>
        <AdvancedToggle initial={shop.advanced_available} />
      </div>

      {/* Share request link */}
      <div className="mb-4 rounded-2xl border border-orange-100 bg-orange-50 p-5">
        <p className="mb-1 text-sm font-semibold text-slate-800">Your request link</p>
        <p className="mb-3 text-xs text-slate-500">Share this with customers — they can upload their model and get a quote.</p>
        <CopyLinkButton url={`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/request/${shop.id}`} />
      </div>

      {/* View public page link */}
      <div className="mb-2 flex justify-end">
        <Link href={`/printers/${shop.id}`} className="text-xs text-orange-500 hover:text-orange-600 transition">
          View public page →
        </Link>
      </div>

      {/* Editable listing details + pickup/delivery */}
      <ListingEditor shop={shop} machineRatePerHour={primaryPrinter.machine_rate_per_hour} />

      {/* Sample print photos */}
      <div className="mt-4">
        <PhotoGalleryEditor initialPhotos={shop.sample_photos} />
      </div>

      {/* ── Pricing preview ── */}
      {(() => {
        const powerWatts     = primaryPrinter.power_watts ?? 200
        const elecRate       = shop.electricity_rate      ?? DEFAULT_ELECTRICITY_RATE
        const markupPct      = shop.markup_percent        ?? DEFAULT_MARKUP_PERCENT
        const machineRate    = primaryPrinter.machine_rate_per_hour ?? DEFAULT_MACHINE_RATE
        const wastePct       = shop.waste_percent         ?? DEFAULT_WASTE_PERCENT
        const filamentCosts  = (primaryPrinter.filament_costs ?? {}) as Record<string, number>
        const materials      = (shop.materials ?? []) as FilamentMaterial[]

        if (materials.length === 0) return null

        const defaultProfile = profiles.find((p) => p.is_default) ?? profiles[0] ?? null

        const tiers = [
          { key: 'basic'    as const, label: 'Basic',    infill: defaultProfile?.infill_basic    ?? 15, walls: defaultProfile?.wall_count_basic    ?? 3 },
          { key: 'advanced' as const, label: 'Advanced', infill: 40, walls: 4 },
        ]

        const rows = materials.map((mat) => {
          const configured = filamentCosts[mat] != null
          const costPerKg  = filamentCosts[mat] ?? DEFAULT_FILAMENT_COST_PER_KG[mat]
          const prices     = tiers.map(({ key, infill, walls }) =>
            calculateEstimate({
              size: 'medium', quality: key, material: mat,
              power_watts: powerWatts, cost_per_kg: costPerKg,
              electricity_rate: elecRate, markup_percent: markupPct,
              machine_rate_per_hour: machineRate, waste_percent: wastePct,
              custom_infill: infill, wall_count: walls,
            }).suggested_price
          )
          return { mat, configured, prices }
        })

        const anyUnconfigured = rows.some((r) => !r.configured)

        return (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">Pricing preview</h3>
                <p className="text-xs text-slate-400 mt-0.5">Typical medium-size print at each quality tier, with your current settings.</p>
              </div>
              <Link href="/dashboard/equipment" className="shrink-0 text-xs font-medium text-orange-500 hover:text-orange-600 transition">
                Set filament costs →
              </Link>
            </div>

            {/* Grid */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-2 text-left text-xs font-medium text-slate-400">Material</th>
                    {tiers.map((t) => (
                      <th key={t.key} className="pb-2 text-right text-xs font-medium text-slate-400">{t.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map(({ mat, configured, prices }) => (
                    <tr key={mat}>
                      <td className="py-2.5 pr-4">
                        <span className="font-medium text-slate-800">{MATERIAL_LABELS[mat]}</span>
                        {!configured && (
                          <span className="ml-1.5 text-[10px] text-slate-400">*</span>
                        )}
                      </td>
                      {prices.map((p, i) => (
                        <td key={i} className="py-2.5 text-right tabular-nums font-semibold text-slate-700">
                          ~RM {Math.round(p)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {anyUnconfigured && (
              <p className="text-[11px] text-slate-400">
                * Using default market rates. Go to <Link href="/dashboard/equipment" className="text-orange-500 hover:underline">Equipment → Filament stock</Link> to enter your actual filament costs for more accurate estimates.
              </p>
            )}

            {/* Formula */}
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 space-y-1.5 text-xs text-slate-500">
              <p className="font-semibold text-slate-700 mb-1">Your formula</p>
              <p>Filament = weight × (your cost per kg)</p>
              <p>Electricity = print time × ({powerWatts}W ÷ 1000) × RM {elecRate}/kWh</p>
              <p>Machine = print time × RM {machineRate}/hr (depreciation &amp; wear)</p>
              <p className="border-t border-slate-200 pt-1.5">Subtotal = filament + electricity + machine</p>
              <p>Overhead = subtotal × {wastePct}% (waste &amp; maintenance buffer)</p>
              <p>Base cost = subtotal + overhead</p>
              <p className="border-t border-slate-200 pt-1.5 font-medium text-slate-600">
                Final price = base cost + {markupPct}% profit margin
              </p>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
