'use client'

import { useState, useTransition } from 'react'
import { Plus, X, ImageIcon } from 'lucide-react'
import { updateShopPhotos } from '@/lib/actions'

export default function PhotoGalleryEditor({
  initialPhotos,
}: {
  initialPhotos: string[]
}) {
  const [photos, setPhotos] = useState(initialPhotos)
  const [newUrl, setNewUrl] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function save(next: string[]) {
    setError('')
    startTransition(async () => {
      const result = await updateShopPhotos(next)
      if (result?.error) { setError(result.error); return }
      setPhotos(next)
    })
  }

  function handleAdd() {
    const url = newUrl.trim()
    if (!url) return
    save([...photos, url])
    setNewUrl('')
  }

  function handleRemove(url: string) {
    save(photos.filter((p) => p !== url))
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <div>
        <h3 className="font-semibold text-slate-900">Sample prints</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Show customers examples of your work — builds trust before they request a print.
          Upload to Imgur or Google Photos and paste the link.
        </p>
      </div>

      {photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {photos.map((url) => (
            <div key={url} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Sample print" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => handleRemove(url)}
                disabled={isPending}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/80 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 py-6 text-xs text-slate-400">
          <ImageIcon className="h-4 w-4" /> No sample photos yet
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
          placeholder="https://... (imgur, google photos, etc.)"
          className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={isPending || !newUrl.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
