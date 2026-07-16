'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { List, Kanban, AlertCircle, Loader2 } from 'lucide-react'
import type { PrintRequest, RequestStatus, RequestPrinterView } from '@/lib/types'
import RequestCard from './RequestCard'
import { updateRequestStatus } from '@/lib/actions'

type TabKey = 'new' | 'progress' | 'done' | 'all'

const TAB_STATUSES: Record<TabKey, RequestStatus[]> = {
  new: ['new'],
  progress: ['quoted', 'accepted', 'printing'],
  done: ['done', 'collected', 'reviewed'],
  all: ['new', 'quoted', 'accepted', 'printing', 'done', 'collected', 'reviewed', 'declined', 'cancelled'],
}

type Column = {
  id: string
  title: string
  statuses: RequestStatus[]
  bg: string
  border: string
  text: string
}

const ALL_COLUMNS: Column[] = [
  { id: 'new', title: 'Incoming', statuses: ['new'], bg: 'bg-blue-50/50', border: 'border-blue-100', text: 'text-blue-700' },
  { id: 'quoted', title: 'Quoted', statuses: ['quoted'], bg: 'bg-amber-50/50', border: 'border-amber-100', text: 'text-amber-700' },
  { id: 'accepted', title: 'To Print', statuses: ['accepted'], bg: 'bg-indigo-50/50', border: 'border-indigo-100', text: 'text-indigo-700' },
  { id: 'printing', title: 'Printing', statuses: ['printing'], bg: 'bg-purple-50/50', border: 'border-purple-100', text: 'text-purple-700' },
  { id: 'done', title: 'Ready', statuses: ['done'], bg: 'bg-green-50/50', border: 'border-green-100', text: 'text-green-700' },
  { id: 'collected', title: 'Completed', statuses: ['collected', 'reviewed'], bg: 'bg-slate-50/50', border: 'border-slate-200', text: 'text-slate-700' },
]

export default function JobQueueBoard({
  requests: initialRequests,
  printer,
}: {
  requests: PrintRequest[]
  printer: RequestPrinterView
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Tabs and view mode
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')

  // Local state for optimistic updates
  const [requests, setRequests] = useState<PrintRequest[]>(initialRequests)
  const [errorToast, setErrorToast] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  // Sync state if initialRequests changes (e.g. on server revalidation)
  useEffect(() => {
    setRequests(initialRequests)
  }, [initialRequests])

  // Clear error toast after 4s
  useEffect(() => {
    if (errorToast) {
      const timer = setTimeout(() => setErrorToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [errorToast])

  // ── Drag & Drop Handlers ─────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, reqId: string) {
    e.dataTransfer.setData('text/plain', reqId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent, columnId: string) {
    e.preventDefault()
    if (dragOverCol !== columnId) {
      setDragOverCol(columnId)
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setDragOverCol(null)
  }

  function handleDrop(e: React.DragEvent, targetColumnId: string) {
    e.preventDefault()
    setDragOverCol(null)
    setErrorToast(null)

    const requestId = e.dataTransfer.getData('text/plain')
    if (!requestId) return

    const request = requests.find((r) => r.id === requestId)
    if (!request) return

    const sourceStatus = request.status
    const targetStatus = ALL_COLUMNS.find((col) => col.id === targetColumnId)?.statuses[0]

    if (!targetStatus) return

    // If already in target status, do nothing
    if (request.status === targetStatus || (targetColumnId === 'collected' && ['collected', 'reviewed'].includes(request.status))) {
      return
    }

    // ── Transition Validation ──
    const allowedOperational = ['accepted', 'printing', 'done', 'collected', 'reviewed']
    const isSourceOperational = allowedOperational.includes(sourceStatus)
    const isTargetOperational = allowedOperational.includes(targetStatus)

    // A: Dragging from new or quoted into printing/done/collected is blocked
    if (!isSourceOperational && isTargetOperational) {
      setErrorToast('This request has not been accepted by the customer yet.')
      return
    }

    // B: Dragging new to quoted requires typing a price first
    if (sourceStatus === 'new' && targetStatus === 'quoted') {
      setErrorToast('Please click "Send Quote" inside the request details card to submit a quote.')
      return
    }

    // C: Dragging any other invalid moves
    if (!isSourceOperational || !isTargetOperational) {
      setErrorToast('Invalid request status transition.')
      return
    }

    // ── Optimistic state update ──
    const originalRequests = [...requests]
    setRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: targetStatus } : r))
    )

    // ── DB sync in background transition ──
    startTransition(async () => {
      const result = await updateRequestStatus(requestId, targetStatus)
      if (result?.error) {
        setRequests(originalRequests) // rollback
        setErrorToast(`Could not update status: ${result.error}`)
      } else {
        router.refresh()
      }
    })
  }

  // ── Helpers ──────────────────────────────────────────────────────

  const filteredRequests = requests.filter((r) => TAB_STATUSES[activeTab].includes(r.status))

  // Determine columns to display based on active tab
  const displayedColumns = ALL_COLUMNS.filter((col) => {
    if (activeTab === 'new') return col.id === 'new'
    if (activeTab === 'progress') return ['quoted', 'accepted', 'printing'].includes(col.id)
    if (activeTab === 'done') return ['done', 'collected'].includes(col.id)
    return true // 'all' shows everything
  })

  return (
    <div className="space-y-4">
      {/* ── Tabs & View Mode Toggles ── */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center border-b border-slate-100 pb-2">
        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto">
          {(Object.keys(TAB_STATUSES) as TabKey[]).map((tabKey) => {
            const count = requests.filter((r) => TAB_STATUSES[tabKey].includes(r.status)).length
            const isActive = activeTab === tabKey
            const label =
              tabKey === 'new' ? 'New' :
              tabKey === 'progress' ? 'In Progress' :
              tabKey === 'done' ? 'Ready / Done' :
              'All'

            return (
              <button
                key={tabKey}
                onClick={() => setActiveTab(tabKey)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-orange-50 text-orange-600 font-semibold shadow-sm'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                {label}
                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                      isActive ? 'bg-orange-200 text-orange-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* View Mode Toggle */}
        <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1 self-start sm:self-auto shrink-0 shadow-sm">
          <button
            onClick={() => setViewMode('kanban')}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
              viewMode === 'kanban' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Kanban className="h-3.5 w-3.5" />
            Board
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
              viewMode === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            List
          </button>
        </div>
      </div>

      {/* ── Error Toast (Overlay Alert) ── */}
      {errorToast && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 animate-slide-in">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <p className="font-medium">{errorToast}</p>
        </div>
      )}

      {/* ── List View ── */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {filteredRequests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center bg-slate-50/20">
              <p className="text-slate-400 text-sm font-medium">No requests match this filter</p>
            </div>
          ) : (
            filteredRequests.map((request) => (
              <RequestCard key={request.id} request={request} printer={printer} />
            ))
          )}
        </div>
      )}

      {/* ── Kanban View ── */}
      {viewMode === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin select-none">
          {displayedColumns.map((col) => {
            const colRequests = requests.filter((r) => col.statuses.includes(r.status))
            const isTarget = dragOverCol === col.id

            return (
              <div
                key={col.id}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`flex w-80 shrink-0 flex-col rounded-2xl border p-3.5 transition-all min-h-[450px] ${col.bg} ${
                  isTarget ? 'border-orange-500 ring-2 ring-orange-500/20 scale-[1.01] bg-orange-50/20 shadow-md' : col.border
                }`}
              >
                {/* Column Header */}
                <div className="mb-3.5 flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className={`text-sm font-bold tracking-wide uppercase ${col.text}`}>{col.title}</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                    {colRequests.length}
                  </span>
                </div>

                {/* Column Cards Container */}
                <div className="flex-1 space-y-3 overflow-y-auto max-h-[600px] scrollbar-thin pr-1">
                  {colRequests.length === 0 ? (
                    <div className="flex h-full min-h-[150px] items-center justify-center rounded-xl border border-dashed border-slate-200 py-6 text-center bg-white/40">
                      <p className="text-xs text-slate-400">Empty column</p>
                    </div>
                  ) : (
                    colRequests.map((request) => (
                      <div
                        key={request.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, request.id)}
                        className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow duration-200 rounded-xl"
                      >
                        <RequestCard request={request} printer={printer} />
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Syncing indicator */}
      {isPending && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-slate-950/20">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-400" />
          Syncing changes…
        </div>
      )}
    </div>
  )
}
