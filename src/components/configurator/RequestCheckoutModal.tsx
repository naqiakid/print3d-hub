'use client'

import { useState } from 'react'
import { X, CheckCircle2, Loader2, Sparkles, MessageCircle, ExternalLink, ShieldCheck, MapPin, Truck, AlertCircle, Box, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { submitRequest } from '@/lib/actions'
import type { RequestPrinterView, FilamentMaterial } from '@/lib/types'
import { MATERIAL_LABELS } from '@/lib/types'
import type { SubObjectItem, PartConfig } from './PriceConfigurator'
import Link from 'next/link'

interface Props {
  isOpen: boolean
  onClose: () => void
  files: File[]
  quantity?: number
  dimensions?: { x: number; y: number; z: number }
  volumeCc?: number
  subObjects?: SubObjectItem[]
  partConfigs?: Record<string, PartConfig>
  material: FilamentMaterial
  colorName: string
  colorHex: string
  infill: number
  nozzle: number
  estimate: {
    weight: number
    hours: number
    price: number
    rawPrice: number
    discountAmount: number
  }
  printer: RequestPrinterView
  activePromo?: { code: string; discount_pct: number } | null
}

export default function RequestCheckoutModal({
  isOpen,
  onClose,
  files,
  quantity = 1,
  dimensions,
  volumeCc,
  subObjects,
  partConfigs = {},
  material,
  colorName,
  colorHex,
  infill,
  nozzle,
  estimate,
  printer,
  activePromo,
}: Props) {
  // Form States
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>('pickup')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [notes, setNotes] = useState('')

  // Submission States
  const [submitting, setSubmitting] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!customerName.trim()) {
      setErrorMessage('Please enter your full name.')
      return
    }

    const cleanPhone = customerPhone.replace(/\D/g, '')
    if (cleanPhone.length < 8) {
      setErrorMessage('Please enter a valid WhatsApp / contact phone number.')
      return
    }

    if (!customerEmail.trim() || !customerEmail.includes('@') || !customerEmail.includes('.')) {
      setErrorMessage('Please enter a valid email address for order notifications.')
      return
    }

    if (fulfillment === 'delivery' && !deliveryAddress.trim()) {
      setErrorMessage('Please enter your full delivery address.')
      return
    }

    setSubmitting(true)

    try {
      // 1. Upload files to Supabase Storage bucket 'stl-files'
      const supabase = createClient()
      const uploadedUrls: string[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setUploadStatus(`Uploading 3D file ${i + 1} of ${files.length} (${file.name})...`)
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `anonymous/${Date.now()}_${cleanName}`

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('stl-files')
          .upload(path, file, { upsert: true })

        if (uploadErr || !uploadData) {
          const isNetworkError = uploadErr?.message === 'Failed to fetch' || uploadErr?.name === 'TypeError'
          throw new Error(
            isNetworkError
              ? 'Unable to reach the storage server. Please verify your Supabase project is active or unpaused.'
              : (uploadErr?.message || `Failed to upload ${file.name}`)
          )
        }

        const { data: urlData } = supabase.storage.from('stl-files').getPublicUrl(path)
        uploadedUrls.push(urlData.publicUrl)
      }

      setUploadStatus('Saving your custom print job...')

      // 2. Format color preferences for multi-part or single-part
      const colorPreferences = (subObjects && subObjects.length > 1)
        ? subObjects.map((sub, idx) => {
            const cfg = partConfigs[sub.id] || { material, colorHex, colorName }
            return {
              part_number: idx + 1,
              file_name: files[0]?.name || sub.name,
              part_name: sub.name,
              color: cfg.colorName,
              color_hex: cfg.colorHex,
              material: cfg.material,
            }
          })
        : [{
            part_number: 1,
            file_name: files[0]?.name || 'Model',
            part_name: files[0]?.name || 'Model',
            color: colorName,
            color_hex: colorHex,
            material: material,
          }]

      // 3. Prepare notes with dimensions and part specifications
      const dimsText = dimensions ? `[Dims: ${dimensions.x}×${dimensions.y}×${dimensions.z}mm]` : ''
      const totalPartsCount = subObjects && subObjects.length > 1
        ? quantity * subObjects.length
        : quantity
      const qtyLabel = subObjects && subObjects.length > 1
        ? `${quantity} sets (${totalPartsCount} parts total)`
        : `${quantity} ${quantity > 1 ? 'copies' : 'piece'}`

      const partsSummary = (subObjects && subObjects.length > 1)
        ? `\nParts Breakdown (${qtyLabel}):\n` + subObjects.map((s, i) => {
            const cfg = partConfigs[s.id] || { material, colorHex, colorName }
            return `• Part ${i + 1} (${s.name}) ×${quantity}: ${s.dimensions.x}×${s.dimensions.y}×${s.dimensions.z}mm | ${cfg.material.toUpperCase()} (${cfg.colorName}) | ${(s.volumeCc * quantity).toFixed(1)}cm³`
          }).join('\n')
        : `\nSpec: ${material.toUpperCase()} · ${colorName} · ${qtyLabel}`

      const estNote = `[Instant Estimate: RM ${estimate.price.toFixed(2)}]`
      const fullNotes = `${dimsText} [Quantity: ${qtyLabel}] ${partsSummary}\nInfill: ${infill}%\nNozzle: ${nozzle}mm\n${estNote}${notes.trim() ? `\n\nCustomer Notes:\n${notes.trim()}` : ''}`

      // 4. Submit Request (initial status is 'new' awaiting maker review and official quote)
      const res = await submitRequest({
        owner_id: printer.id,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_email: customerEmail.trim().toLowerCase(),
        description: `Custom 3D print: ${files.map((f) => f.name).join(', ')} (${qtyLabel})`,
        print_type: 'custom',
        material: material,
        color: colorName,
        color_hex: colorHex,
        size: Math.max(dimensions?.x || 0, dimensions?.y || 0, dimensions?.z || 0) <= 100 ? 'small' : 'medium',
        quality: 'basic',
        deadline: new Date(Date.now() + 48 * 3600 * 1000).toISOString().split('T')[0],
        notes: fullNotes,
        stl_url: uploadedUrls[0] || null,
        stl_urls: uploadedUrls,
        weight_g: estimate.weight,
        print_hours: estimate.hours,
        fulfillment: fulfillment,
        delivery_address: fulfillment === 'delivery' ? deliveryAddress.trim() : null,
        custom_infill: infill,
        affiliate_code: activePromo?.code || null,
        color_preferences: colorPreferences,
      })

      if ('error' in res) {
        throw new Error(res.error)
      }

      setCreatedRequestId(res.id)
    } catch (err: any) {
      console.error('Failed to submit order:', err)
      setErrorMessage(err?.message || 'Failed to submit request. Please try again or reach out via WhatsApp.')
    } finally {
      setSubmitting(false)
      setUploadStatus('')
    }
  }

  const cleanWhatsApp = (printer.whatsapp || '60123456789').replace(/\D/g, '')
  const orderRef = createdRequestId ? `QID-${createdRequestId.slice(0, 8).toUpperCase()}` : ''
  const totalPartsCount = subObjects && subObjects.length > 1
    ? quantity * subObjects.length
    : quantity
  const qtyLabel = subObjects && subObjects.length > 1
    ? `${quantity} sets (${totalPartsCount} parts total)`
    : `${quantity} ${quantity > 1 ? 'copies' : 'piece'}`

  const waConfirmationUrl = createdRequestId
    ? `https://wa.me/${cleanWhatsApp}?text=${encodeURIComponent(
        `Hi Qid3D Studio! I just submitted a 3D print request:\n- Order Ref: ${orderRef}\n- Name: ${customerName}\n- File: ${files.map((f) => f.name).join(', ')}\n- Quantity: ${qtyLabel}\n- Est. Cost: RM ${estimate.price.toFixed(2)}\n\nPlease review my 3D model!`
      )}`
    : '#'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-6 max-h-[92vh] flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-orange-500 text-white shadow-sm text-xs font-bold">
              ⚡
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-none">
                {createdRequestId ? 'Print Request Submitted!' : 'Complete Your 3D Print Request'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                {createdRequestId
                  ? 'Your 3D CAD files have been received by Qid3D Studio.'
                  : 'Fast turnaround in Ampang, Selangor · No upfront payment required to quote'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 text-xs">
          {createdRequestId ? (
            /* Success Screen */
            <div className="py-6 text-center space-y-5 animate-fade-in">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner">
                <CheckCircle2 className="h-10 w-10" />
              </div>

              <div className="space-y-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  <ShieldCheck className="h-3.5 w-3.5" /> Order Received
                </span>
                <h4 className="text-2xl font-black text-slate-900 tracking-tight">
                  Thank You, {customerName}!
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Your print request has been registered in our studio queue. We are verifying file mesh thickness and layer stability on the Ender-3 V3 SE.
                </p>
              </div>

              {/* Order Reference Card */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 max-w-sm mx-auto space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium uppercase text-[10px]">Order Reference</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">{orderRef}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium uppercase text-[10px]">Estimated Price</span>
                  <span className="font-mono font-black text-orange-600 text-sm">RM {estimate.price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium uppercase text-[10px]">Fulfillment</span>
                  <span className="font-semibold text-slate-700 capitalize">{fulfillment}</span>
                </div>
              </div>

              {/* Next Steps Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2 max-w-md mx-auto">
                <a
                  href={waConfirmationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 shadow-lg shadow-emerald-600/20 transition active:scale-98"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Notify via WhatsApp</span>
                </a>
                <Link
                  href={`/track/${createdRequestId}`}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 shadow-sm transition active:scale-98"
                >
                  <span>Live Tracking</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>

              <p className="text-[11px] text-slate-400">
                You will also receive updates at <strong>{customerEmail}</strong>.
              </p>
            </div>
          ) : (
            /* Order Form */
            <form onSubmit={handleSubmitOrder} className="space-y-5">
              {/* Configured Model Summary Banner */}
              <div className="rounded-2xl border border-orange-200/80 bg-gradient-to-r from-orange-50/80 via-amber-50/40 to-slate-50 p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Box className="h-4 w-4 text-orange-500" />
                    <span className="font-bold text-slate-900 text-xs">
                      {files.length} File{files.length > 1 ? 's' : ''} Configured on Ender-3 V3 SE
                    </span>
                    {quantity > 1 && (
                      <span className="inline-flex items-center text-[10px] font-bold text-orange-700 bg-orange-100 border border-orange-200 px-2 py-0.5 rounded-full">
                        🏷️ {qtyLabel}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-base font-black text-orange-600">
                      RM {estimate.price.toFixed(2)}
                    </span>
                    {estimate.discountAmount > 0 && (
                      <p className="text-[10px] text-emerald-600 font-semibold font-mono">
                        {activePromo?.discount_pct
                          ? `Includes ${activePromo.discount_pct}% Promo`
                          : 'Includes Volume Discount'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Sub-Objects Pills / Parts Breakdown */}
                {subObjects && subObjects.length > 1 ? (
                  <div className="space-y-1.5 pt-1 border-t border-orange-200/50">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Parts Configured ({subObjects.length} unique parts{quantity > 1 ? ` · ${quantity * subObjects.length} total pieces` : ''}):
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {subObjects.map((sub, idx) => {
                        const cfg = partConfigs[sub.id] || { material, colorHex, colorName }
                        return (
                          <div
                            key={sub.id}
                            className="bg-white/90 rounded-xl p-2 border border-orange-100 flex items-center justify-between text-[11px]"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="h-3 w-3 rounded-full border border-slate-300 shrink-0"
                                style={{ backgroundColor: cfg.colorHex }}
                              />
                              <span className="font-semibold text-slate-800 truncate">
                                Part {idx + 1}: {sub.name}
                              </span>
                              {quantity > 1 && (
                                <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-1 rounded shrink-0">
                                  ×{quantity}
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-[10px] text-orange-600 font-bold uppercase shrink-0">
                              {cfg.material}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-orange-200/50 text-[11px] text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-3 w-3 rounded-full border border-slate-300"
                        style={{ backgroundColor: colorHex }}
                      />
                      <span><strong>{MATERIAL_LABELS[material]}</strong> ({colorName})</span>
                    </div>
                    {dimensions && (
                      <span className="font-mono">
                        {dimensions.x}×{dimensions.y}×{dimensions.z}mm
                      </span>
                    )}
                    {quantity > 1 && (
                      <span className="font-bold text-orange-600">
                        {quantity} copies
                      </span>
                    )}
                    <span>{infill}% Infill</span>
                    <span>~{estimate.weight}g</span>
                  </div>
                )}
              </div>

              {/* Contact Information Fields */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  1. Contact Information
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Alex Tan"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium focus:border-orange-500 focus:bg-white focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      WhatsApp / Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="e.g. 012-345 6789"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium focus:border-orange-500 focus:bg-white focus:outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="e.g. alex@example.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium focus:border-orange-500 focus:bg-white focus:outline-none transition"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    We will send your order tracking link and status updates here.
                  </p>
                </div>
              </div>

              {/* Fulfillment Method Selection */}
              <div className="space-y-3 pt-2 border-t border-slate-150">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  2. Collection / Delivery
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFulfillment('pickup')}
                    className={`flex items-start gap-3 p-3 rounded-2xl border text-left transition ${
                      fulfillment === 'pickup'
                        ? 'border-orange-500 bg-orange-50/50 ring-1 ring-orange-500'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <MapPin className={`h-4 w-4 mt-0.5 shrink-0 ${fulfillment === 'pickup' ? 'text-orange-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 text-xs">Self-Pickup</span>
                        <span className="bg-emerald-100 text-emerald-700 font-bold text-[9px] px-1.5 py-0.2 rounded">FREE</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Ampang / Taman Melawati, Selangor
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFulfillment('delivery')}
                    className={`flex items-start gap-3 p-3 rounded-2xl border text-left transition ${
                      fulfillment === 'delivery'
                        ? 'border-orange-500 bg-orange-50/50 ring-1 ring-orange-500'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <Truck className={`h-4 w-4 mt-0.5 shrink-0 ${fulfillment === 'delivery' ? 'text-orange-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 text-xs">Courier / Runner</span>
                        <span className="text-slate-400 text-[10px]">PosLaju / Grab</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Delivered safely to your doorstep
                      </p>
                    </div>
                  </button>
                </div>

                {fulfillment === 'delivery' && (
                  <div className="animate-fade-in pt-1">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Shipping / Delivery Address <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Street, Building, Unit No, Postcode, City, State"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs font-medium focus:border-orange-500 focus:bg-white focus:outline-none transition resize-none"
                    />
                  </div>
                )}
              </div>

              {/* Special Instructions (Optional) */}
              <div className="pt-2 border-t border-slate-150">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Special Instructions or Deadline (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Need mounting screws reinforced, urgent deadline by Friday"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium focus:border-orange-500 focus:bg-white focus:outline-none transition"
                />
              </div>

              {errorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 text-xs flex items-center gap-2 animate-shake">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-150 flex flex-col sm:flex-row gap-2.5 items-center">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="w-full sm:w-auto px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold transition text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:flex-1 flex items-center justify-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-5 shadow-lg shadow-orange-500/20 transition active:scale-98 disabled:opacity-75"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{uploadStatus || 'Processing request...'}</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Print Request (RM {estimate.price.toFixed(2)})</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
