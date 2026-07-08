import Link from 'next/link'
import { MapPin, Star } from 'lucide-react'
import type { Shop } from '@/lib/types'
import { PRINT_TYPE_LABELS, SIZE_LABELS } from '@/lib/types'

type Props = {
  printer: Shop
  distanceKm?: number
}

export default function PrinterCard({ printer, distanceKm }: Props) {
  return (
    <Link href={`/printers/${printer.id}`} className="group block">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 group-hover:border-orange-200 group-hover:shadow-md">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold text-slate-900 transition-colors group-hover:text-orange-600">
              {printer.name}
            </h3>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              printer.available ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {printer.available ? 'Available' : 'Busy'}
          </span>
        </div>

        {/* Description */}
        <p className="mb-3 line-clamp-2 text-sm text-slate-600">{printer.description}</p>

        {/* Print type badges */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {printer.print_types.map((type) => (
            <span
              key={type}
              className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700"
            >
              {PRINT_TYPE_LABELS[type]}
            </span>
          ))}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {distanceKm !== undefined && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {distanceKm < 1
                ? `${Math.round(distanceKm * 1000)}m away`
                : `${distanceKm.toFixed(1)}km away`}
            </span>
          )}
          <span>{SIZE_LABELS[printer.max_size]}</span>
          <span>{printer.turnaround}</span>
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="text-sm font-medium text-slate-900">{printer.rating}</span>
            <span className="text-xs text-slate-400">({printer.review_count})</span>
          </div>
          <span className="text-sm font-semibold text-slate-900">
            {printer.price_min === 0 && printer.price_max === 0
              ? 'Quote on request'
              : `RM${printer.price_min}–RM${printer.price_max}`}
          </span>
        </div>
      </div>
    </Link>
  )
}
