/**
 * Approvals Table Component
 * Display and manage pending time entries
 */

'use client'

import { useState } from 'react'
import { format } from 'date-fns'

interface TimeEntry {
  id: string
  employee_id: string
  employee?: {
    profile?: {
      full_name: string
      email: string
    }
  }
  clock_in_reported_at: string
  clock_out_reported_at: string | null
  status: 'pending_clock_in' | 'pending_approval' | 'approved' | 'rejected'
  schedule?: {
    job?: {
      title: string
    }
  }
}

interface ApprovalsTableProps {
  timeEntries: TimeEntry[]
  onApprove: (entryId: string, adjustments?: { clock_in?: string; clock_out?: string; reason?: string }) => Promise<void>
  onReject: (entryId: string, reason: string) => Promise<void>
  onBulkApprove: (entryIds: string[]) => Promise<void>
  readonly?: boolean
}

export default function ApprovalsTable({
  timeEntries,
  onApprove,
  onReject,
  onBulkApprove,
  readonly = false,
}: ApprovalsTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [adjustments, setAdjustments] = useState<Record<string, { clock_in?: string; clock_out?: string }>>({})
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({})
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === timeEntries.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(timeEntries.map((e) => e.id)))
    }
  }

  const handleApprove = async (entryId: string) => {
    setProcessingIds(new Set(processingIds).add(entryId))
    try {
      const adj = adjustments[entryId]
      const payload: any = {}

      if (adj?.clock_in) {
        payload.clock_in_approved_at = new Date(adj.clock_in).toISOString()
      }
      if (adj?.clock_out) {
        payload.clock_out_approved_at = new Date(adj.clock_out).toISOString()
      }
      if (adj?.clock_in || adj?.clock_out) {
        payload.edit_reason = 'Owner adjusted times during approval'
      }

      await onApprove(entryId, Object.keys(payload).length > 0 ? payload : undefined)

      // Clear adjustments after approval
      const newAdj = { ...adjustments }
      delete newAdj[entryId]
      setAdjustments(newAdj)
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(entryId)
        return newSet
      })
    }
  }

  const handleReject = async (entryId: string) => {
    const reason = rejectReasons[entryId]
    if (!reason || reason.trim() === '') {
      alert('Please provide a reason for rejection')
      return
    }

    setProcessingIds(new Set(processingIds).add(entryId))
    try {
      await onReject(entryId, reason)

      // Clear reject reason after rejection
      const newReasons = { ...rejectReasons }
      delete newReasons[entryId]
      setRejectReasons(newReasons)
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(entryId)
        return newSet
      })
    }
  }

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one entry to approve')
      return
    }

    if (!confirm(`Approve ${selectedIds.size} time entries?`)) {
      return
    }

    try {
      await onBulkApprove(Array.from(selectedIds))
      setSelectedIds(new Set())
    } catch (error) {
      console.error('Bulk approve error:', error)
    }
  }

  const calculateHours = (clockIn: string, clockOut: string | null) => {
    if (!clockOut) return 'In progress'
    const start = new Date(clockIn)
    const end = new Date(clockOut)
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    return `${hours.toFixed(2)}h`
  }

  if (timeEntries.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center">
        <p className="text-gray-400">No pending time entries to approve</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      {/* Bulk Actions */}
      {!readonly && (
        <div className="bg-gray-900 px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <input
              type="checkbox"
              checked={selectedIds.size === timeEntries.length}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm text-gray-400">
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
            </span>
          </div>
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkApprove}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
            >
              Bulk Approve ({selectedIds.size})
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-900">
            <tr>
              {!readonly && <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Select</th>}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Employee</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Clock In</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Clock Out</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Hours</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Job</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
              {!readonly && <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Actions</th>}
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {timeEntries.map((entry) => {
              const isProcessing = processingIds.has(entry.id)
              const employeeName = entry.employee?.profile?.full_name || 'Unknown'
              const jobTitle = entry.schedule?.job?.title || '-'

              return (
                <tr key={entry.id} className={isProcessing ? 'opacity-50' : ''}>
                  {!readonly && (
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(entry.id)}
                        onChange={() => toggleSelection(entry.id)}
                        disabled={isProcessing}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                    </td>
                  )}
                  <td className="px-4 py-4">
                    <div className="text-sm font-medium text-white">{employeeName}</div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-300">
                    {format(new Date(entry.clock_in_reported_at), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-300">
                      {format(new Date(entry.clock_in_reported_at), 'h:mm a')}
                    </div>
                    <input
                      type="time"
                      value={adjustments[entry.id]?.clock_in?.split('T')[1]?.slice(0, 5) || ''}
                      onChange={(e) => {
                        const date = format(new Date(entry.clock_in_reported_at), 'yyyy-MM-dd')
                        setAdjustments({
                          ...adjustments,
                          [entry.id]: {
                            ...adjustments[entry.id],
                            clock_in: `${date}T${e.target.value}`,
                          },
                        })
                      }}
                      disabled={isProcessing}
                      className="mt-1 text-xs bg-gray-700 border border-gray-600 text-white rounded px-2 py-1"
                      placeholder="Adjust"
                    />
                  </td>
                  <td className="px-4 py-4">
                    {entry.clock_out_reported_at ? (
                      <>
                        <div className="text-sm text-gray-300">
                          {format(new Date(entry.clock_out_reported_at), 'h:mm a')}
                        </div>
                        <input
                          type="time"
                          value={adjustments[entry.id]?.clock_out?.split('T')[1]?.slice(0, 5) || ''}
                          onChange={(e) => {
                            const date = format(new Date(entry.clock_out_reported_at!), 'yyyy-MM-dd')
                            setAdjustments({
                              ...adjustments,
                              [entry.id]: {
                                ...adjustments[entry.id],
                                clock_out: `${date}T${e.target.value}`,
                              },
                            })
                          }}
                          disabled={isProcessing}
                          className="mt-1 text-xs bg-gray-700 border border-gray-600 text-white rounded px-2 py-1"
                          placeholder="Adjust"
                        />
                      </>
                    ) : (
                      <span className="text-sm text-yellow-500">Still clocked in</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-300">
                    {calculateHours(entry.clock_in_reported_at, entry.clock_out_reported_at)}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-300">{jobTitle}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleApprove(entry.id)}
                        disabled={isProcessing}
                        className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                        title={!entry.clock_out_reported_at ? 'Approve clock-in (employee still working)' : 'Approve completed shift'}
                      >
                        Approve
                      </button>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={rejectReasons[entry.id] || ''}
                          onChange={(e) =>
                            setRejectReasons({ ...rejectReasons, [entry.id]: e.target.value })
                          }
                          placeholder="Reason..."
                          disabled={isProcessing}
                          className="text-xs bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 w-24"
                        />
                        <button
                          onClick={() => handleReject(entry.id)}
                          disabled={isProcessing}
                          className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
