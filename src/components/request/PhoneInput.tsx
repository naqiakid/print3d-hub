'use client'

import { useId, useState } from 'react'

// Malaysian mobile numbers are 9-10 digits after the +60 country code
// (e.g. +6012-345 6789 = 9 digits, +6011-2345 6789 = 10 digits for the 011 prefix).
function toDigits(raw: string): string {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('60') && d.length > 10) d = d.slice(2)
  if (d.startsWith('0')) d = d.slice(1)
  return d.slice(0, 10)
}

function formatDisplay(digits: string): string {
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`
  return `${digits.slice(0, 2)}-${digits.slice(2, 5)} ${digits.slice(5)}`
}

export function isValidMyPhoneDigits(digits: string): boolean {
  return digits.length >= 9 && digits.length <= 10
}

export default function PhoneInput({
  id,
  name = 'phone',
  required,
  value,
  onChange,
  className = '',
}: {
  id?: string
  name?: string
  required?: boolean
  /** Controlled full value, e.g. "+60123456789". Omit for uncontrolled (uses a hidden input instead). */
  value?: string
  /** Fires with the full E.164-style value, e.g. "+60123456789" (or "" while incomplete). */
  onChange?: (fullValue: string) => void
  className?: string
}) {
  const autoId = useId()
  const inputId = id ?? autoId
  const isControlled = value !== undefined

  const [internalDigits, setInternalDigits] = useState('')
  const digits = isControlled ? toDigits((value ?? '').replace(/^\+?60/, '')) : internalDigits

  const [touched, setTouched] = useState(false)
  const showError = touched && digits.length > 0 && !isValidMyPhoneDigits(digits)
  const fullValue = digits ? `+60${digits}` : ''

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const d = toDigits(e.target.value)
    if (!isControlled) setInternalDigits(d)
    onChange?.(d ? `+60${d}` : '')
  }

  return (
    <div>
      <div
        className={`flex items-stretch overflow-hidden rounded-xl border bg-slate-50 transition focus-within:border-orange-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-orange-500/20 ${
          showError ? 'border-red-300' : 'border-slate-200'
        } ${className}`}
      >
        <span className="flex items-center border-r border-slate-200 bg-slate-100 px-3 text-sm font-medium text-slate-500 select-none">
          +60
        </span>
        <input
          id={inputId}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={formatDisplay(digits)}
          onChange={handleChange}
          onBlur={() => setTouched(true)}
          placeholder="12-345 6789"
          required={required}
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
      </div>
      {showError && (
        <p className="mt-1 text-xs text-red-500">Enter a valid Malaysian mobile number (9–10 digits)</p>
      )}
      {!isControlled && <input type="hidden" name={name} value={fullValue} />}
    </div>
  )
}
