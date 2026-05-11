import { CheckCircle } from 'lucide-react'
import RegisterWizard from '@/components/RegisterWizard'

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-orange-600">For Printer Owners</p>
        <h1 className="text-3xl font-bold text-slate-900">List your printer</h1>
        <p className="mt-2 text-slate-600">
          Takes about 3 minutes. Your listing goes live immediately.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-x-6 gap-y-2">
        {['Free to list', 'Set your own prices', 'Get paid at pickup'].map((item) => (
          <div key={item} className="flex items-center gap-1.5 text-sm text-slate-600">
            <CheckCircle className="h-4 w-4 text-green-500" />
            {item}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <RegisterWizard />
      </div>
    </div>
  )
}
