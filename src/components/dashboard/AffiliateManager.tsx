'use client'

import { useState, useTransition } from 'react'
import { Plus, ToggleLeft, ToggleRight, Trash2, Link as LinkIcon, DollarSign, MousePointerClick, ShoppingCart, Percent, X, AlertCircle } from 'lucide-react'
import type { Affiliate, PrintRequest, RequestPrinterView } from '@/lib/types'
import { createAffiliateCode, toggleAffiliateCode, deleteAffiliateCode } from '@/lib/actions'
import { formatRM } from '@/lib/pricing'

export default function AffiliateManager({
  initialAffiliates,
  referredRequests,
  printer,
}: {
  initialAffiliates: Affiliate[]
  referredRequests: PrintRequest[]
  printer: RequestPrinterView
}) {
  const [affiliates, setAffiliates] = useState<Affiliate[]>(initialAffiliates)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Form states
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [commissionPct, setCommissionPct] = useState(5)
  const [discountPct, setDiscountPct] = useState(5)
  const [formError, setFormError] = useState('')

  // Toast / Copy feedback state
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Total referred count & click counts
  const totalClicks = affiliates.reduce((sum, a) => sum + (a.clicks_count ?? 0), 0)
  const totalOrders = referredRequests.length
  
  // Calculate total commission earned (sum of all commissions where price was quoted/paid)
  const totalCommission = referredRequests
    .filter(r => r.status !== 'declined' && r.status !== 'cancelled')
    .reduce((sum, r) => sum + (r.affiliate_commission_amount ?? 0), 0)

  const handleCopyLink = (promoCode: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const link = `${origin}/printers/${printer.id}?ref=${promoCode}`
    navigator.clipboard.writeText(link).then(() => {
      setCopiedCode(promoCode)
      setTimeout(() => setCopiedCode(null), 2500)
    })
  }

  const handleCreateCode = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    const cleanCode = code.trim().toUpperCase()
    if (!cleanCode) {
      setFormError('Promo code is required.')
      return
    }
    if (!name.trim()) {
      setFormError('Promoter name is required.')
      return
    }

    startTransition(async () => {
      const res = await createAffiliateCode({
        code: cleanCode,
        name: name.trim(),
        commission_pct: commissionPct,
        discount_pct: discountPct,
      })

      if ('error' in res) {
        setFormError(res.error)
      } else {
        // Optimistic state update or query reload
        const newAff: Affiliate = {
          id: Math.random().toString(),
          owner_id: printer.id,
          code: cleanCode,
          name: name.trim(),
          commission_pct: commissionPct,
          discount_pct: discountPct,
          is_active: true,
          clicks_count: 0,
          created_at: new Date().toISOString()
        }
        setAffiliates(prev => [newAff, ...prev])
        setShowCreateModal(false)
        setCode('')
        setName('')
        setCommissionPct(5)
        setDiscountPct(5)
      }
    })
  }

  const handleToggleActive = (aff: Affiliate) => {
    const nextActive = !aff.is_active
    setAffiliates(prev => prev.map(a => a.id === aff.id ? { ...a, is_active: nextActive } : a))
    startTransition(async () => {
      await toggleAffiliateCode(aff.id, nextActive)
    })
  }

  const handleDelete = (aff: Affiliate) => {
    if (!confirm(`Delete promo code "${aff.code}"? This action cannot be undone.`)) return
    setAffiliates(prev => prev.filter(a => a.id !== aff.id))
    startTransition(async () => {
      await deleteAffiliateCode(aff.id)
    })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Link Clicks</p>
            <p className="text-3xl font-black text-slate-900 mt-1">{totalClicks}</p>
          </div>
          <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
            <MousePointerClick className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Referred Orders</p>
            <p className="text-3xl font-black text-slate-900 mt-1">{totalOrders}</p>
          </div>
          <div className="rounded-xl bg-purple-50 p-3 text-purple-600">
            <ShoppingCart className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Commission Owed</p>
            <p className="text-3xl font-black text-emerald-600 mt-1">{formatRM(totalCommission)}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
            <DollarSign className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Promotion Policy Alert Box */}
      <div className="rounded-xl border border-orange-100 bg-orange-50/30 p-3.5 text-xs text-orange-800 flex items-start gap-2.5 shadow-sm">
        <span className="text-orange-500 text-base leading-none">💡</span>
        <div>
          <p className="font-bold text-orange-900">Merchant-Funded Promotion Policy (Option A)</p>
          <p className="text-orange-700 mt-0.5 leading-relaxed">
            Customer discounts and promoter commissions are funded directly from your markup profit margins. 
            The customer pays the discounted subtotal directly, and you payout the promoter commission manually offline.
          </p>
        </div>
      </div>

      {/* Main Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Affiliate codes list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Active Promo Codes</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-orange-600 transition"
            >
              <Plus className="h-4 w-4" /> Create Promo Code
            </button>
          </div>

          {affiliates.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center bg-white">
              <Percent className="mx-auto mb-3 h-10 w-10 text-slate-300 animate-pulse" />
              <p className="text-sm font-medium text-slate-600">No promo codes listed yet</p>
              <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">Create promo codes to trace where your print customers are referred from.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {affiliates.map((aff) => (
                <div
                  key={aff.id}
                  className={`rounded-2xl border border-slate-200 p-4 bg-white transition hover:border-slate-350 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    !aff.is_active ? 'opacity-65' : ''
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-orange-600 bg-orange-50 border border-orange-100 rounded px-2.5 py-0.5 text-sm">
                        {aff.code}
                      </span>
                      <span className="text-xs font-bold text-slate-700">{aff.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-semibold space-x-3">
                      <span>Discount: <strong>{aff.discount_pct}%</strong></span>
                      <span>Commission: <strong>{aff.commission_pct}%</strong></span>
                      <span>Clicks: <strong>{aff.clicks_count ?? 0}</strong></span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleCopyLink(aff.code)}
                      className={`inline-flex items-center gap-1 text-[11px] font-bold rounded-lg border border-slate-200 px-2.5 py-1.5 transition ${
                        copiedCode === aff.code
                          ? 'bg-emerald-50 border-emerald-250 text-emerald-700'
                          : 'bg-white text-slate-650 hover:bg-slate-50'
                      }`}
                    >
                      <LinkIcon className="h-3 w-3" />
                      {copiedCode === aff.code ? 'Copied Link!' : 'Copy Invite Link'}
                    </button>

                    <button
                      onClick={() => handleToggleActive(aff)}
                      className="text-slate-400 hover:text-slate-600 transition"
                      title={aff.is_active ? 'Deactivate promo code' : 'Activate promo code'}
                    >
                      {aff.is_active ? (
                        <ToggleRight className="h-7 w-7 text-orange-500" />
                      ) : (
                        <ToggleLeft className="h-7 w-7 text-slate-300" />
                      )}
                    </button>

                    <button
                      onClick={() => handleDelete(aff)}
                      className="rounded-lg p-1.5 text-slate-450 hover:bg-red-50 hover:text-red-650 transition"
                      title="Delete promo code"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Referred Orders Report */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Referred Orders</h2>

          {referredRequests.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 p-5 bg-white text-center text-xs text-slate-450">
              No orders referred via promo codes yet.
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {referredRequests.map((req) => (
                <div key={req.id} className="rounded-2xl border border-slate-150 bg-white p-3 shadow-inner space-y-2">
                  <div className="flex justify-between items-start text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{req.customer_name}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{new Date(req.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className="font-semibold text-orange-600 bg-orange-50/50 border border-orange-100 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide">
                      {req.affiliate_code}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs border-t border-slate-100 pt-2">
                    <span className="text-[10px] font-semibold text-slate-400">Commission</span>
                    <span className="font-black text-emerald-600 font-mono">{formatRM(req.affiliate_commission_amount ?? 0)}</span>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span>Order Total: {formatRM(req.quoted_price ?? 0)}</span>
                    <span className="capitalize font-semibold text-slate-500">{req.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal overlay */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-150 bg-white p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition font-mono font-bold"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <h3 className="text-base font-bold text-slate-900">Create Promo Code</h3>
              <p className="text-xs text-slate-400 mt-0.5">Generate a referral link and matching code for your shop promoters.</p>
            </div>

            <form onSubmit={handleCreateCode} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-550 uppercase tracking-wide mb-1">Promo Code</label>
                <input
                  type="text"
                  placeholder="e.g. DESIGNER5"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:bg-white focus:outline-none transition uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-550 uppercase tracking-wide mb-1">Promoter / Channel Name</label>
                <input
                  type="text"
                  placeholder="e.g. Maker Friend or Instagram Blog"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:bg-white focus:outline-none transition"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-550 uppercase tracking-wide mb-1">Customer Discount (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={discountPct}
                    onChange={(e) => setDiscountPct(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:bg-white focus:outline-none transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-550 uppercase tracking-wide mb-1">Affiliate Commission (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={commissionPct}
                    onChange={(e) => setCommissionPct(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:bg-white focus:outline-none transition"
                    required
                  />
                </div>
              </div>

              {formError && (
                <p className="text-xs text-red-500 flex items-center gap-1 font-semibold">
                  <AlertCircle className="h-3.5 w-3.5" /> {formError}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-650 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 rounded-xl bg-orange-500 py-2.5 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50 transition"
                >
                  {isPending ? 'Creating...' : 'Create Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
