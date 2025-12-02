/**
 * Time Entries Table Component
 * Historical view of approved/rejected time entries
 */

'use client'

import { format } from 'date-fns'
import { useState, useEffect } from 'react'
import { Edit2, History, CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { employeesService } from '@/lib/services'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

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
  clock_in_approved_at: string | null
  clock_out_approved_at: string | null
  status: 'pending_clock_in' | 'pending_approval' | 'approved' | 'rejected'
  edit_reason?: string | null
  approved_at?: string | null
  approver?: {
    full_name: string
  }
  schedule?: {
    job?: {
      title: string
    }
  }
}

interface TimeEntriesTableProps {
  timeEntries: TimeEntry[]
  onExportCSV: () => void
  onRefresh?: () => void
}

interface TimeAdjustment {
  id: string
  original_clock_in: string | null
  original_clock_out: string | null
  new_clock_in: string | null
  new_clock_out: string | null
  adjustment_reason: string
  adjusted_at: string
  adjusted_by: {
    full_name: string
  }
}

function LiveHoursDisplay({ clockIn }: { clockIn: string }) {
  const [hours, setHours] = useState('')

  useEffect(() => {
    const updateHours = () => {
      const start = new Date(clockIn)
      const now = new Date()
      const diff = (now.getTime() - start.getTime()) / (1000 * 60 * 60)
      setHours(diff.toFixed(2))
    }

    updateHours()
    const interval = setInterval(updateHours, 1000) // Update every second

    return () => clearInterval(interval)
  }, [clockIn])

  return <span className="text-blue-400">{hours}h (live)</span>
}

export default function TimeEntriesTable({ timeEntries, onExportCSV, onRefresh }: TimeEntriesTableProps) {
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
  const [newDate, setNewDate] = useState('')
  const [newClockInHour, setNewClockInHour] = useState('08')
  const [newClockInMinute, setNewClockInMinute] = useState('00')
  const [newClockOutHour, setNewClockOutHour] = useState('05')
  const [newClockOutMinute, setNewClockOutMinute] = useState('00')
  const [newClockInAm, setNewClockInAm] = useState<'AM' | 'PM'>('AM')
  const [newClockOutAm, setNewClockOutAm] = useState<'AM' | 'PM'>('PM')
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showAdjustments, setShowAdjustments] = useState(false)
  const [adjustments, setAdjustments] = useState<TimeAdjustment[]>([])
  const [loadingAdjustments, setLoadingAdjustments] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const todayStr = () => new Date().toISOString().split('T')[0]
  const [createDate, setCreateDate] = useState(todayStr())
  const [createClockInHour, setCreateClockInHour] = useState('08')
  const [createClockInMinute, setCreateClockInMinute] = useState('00')
  const [createClockOutHour, setCreateClockOutHour] = useState('05')
  const [createClockOutMinute, setCreateClockOutMinute] = useState('00')
  const [createClockInAm, setCreateClockInAm] = useState<'AM' | 'PM'>('AM')
  const [createClockOutAm, setCreateClockOutAm] = useState<'AM' | 'PM'>('PM')
  const [createReason, setCreateReason] = useState('')
  const [createEmployeeId, setCreateEmployeeId] = useState('')
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([])
  const [employeeSearch, setEmployeeSearch] = useState('')

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const res = await employeesService.getAll()
        if (res.data) {
          setEmployees(
            res.data.map((emp: any) => ({
              id: emp.id,
              name: emp.profile?.full_name || 'Unknown',
            }))
          )
        }
      } catch (err) {
        console.error('Error loading employees', err)
      }
    }
    loadEmployees()
  }, [])

  const openEditDialog = (entry: TimeEntry) => {
    setEditingEntry(entry)
    // Use approved times if available, otherwise reported times
    const clockInTime = entry.clock_in_approved_at || entry.clock_in_reported_at
    const clockOutTime = entry.clock_out_approved_at || entry.clock_out_reported_at

    const toDate = (iso: string) => format(new Date(iso), 'yyyy-MM-dd')
    const toParts = (iso: string) => {
      const date = new Date(iso)
      let hours = date.getHours()
      const minutes = date.getMinutes()
      const ampm: 'AM' | 'PM' = hours >= 12 ? 'PM' : 'AM'
      hours = hours % 12 || 12
      return {
        hour: String(hours).padStart(2, '0'),
        minute: String(minutes).padStart(2, '0'),
        ampm,
      }
    }

    if (clockInTime) {
      const parts = toParts(clockInTime)
      setNewDate(toDate(clockInTime))
      setNewClockInHour(parts.hour)
      setNewClockInMinute(parts.minute)
      setNewClockInAm(parts.ampm)
    } else {
      setNewDate('')
      setNewClockInHour('08')
      setNewClockInMinute('00')
      setNewClockInAm('AM')
    }

    if (clockOutTime) {
      const parts = toParts(clockOutTime)
      setNewClockOutHour(parts.hour)
      setNewClockOutMinute(parts.minute)
      setNewClockOutAm(parts.ampm)
    } else {
      setNewClockOutHour('05')
      setNewClockOutMinute('00')
      setNewClockOutAm('PM')
    }

    setAdjustmentReason('')
  }

  const handleSaveEdit = async () => {
    if (!editingEntry || !adjustmentReason.trim() || !newDate || !newClockInHour || !newClockInMinute) {
      alert('Please provide date, times, and a reason for the adjustment')
      return
    }

    const buildIso = (dateStr: string, hour: string, minute: string, ampm: 'AM' | 'PM') => {
      const h = Number(hour)
      const m = Number(minute)
      let hour24 = h % 12 + (ampm === 'PM' ? 12 : 0)
      if (ampm === 'AM' && h === 12) hour24 = 0
      return new Date(`${dateStr}T${String(hour24).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}:00`).toISOString()
    }

    const clockInIso = buildIso(newDate, newClockInHour, newClockInMinute, newClockInAm)
    const clockOutIso = newClockOutHour && newClockOutMinute
      ? buildIso(newDate, newClockOutHour, newClockOutMinute, newClockOutAm)
      : null

    setIsSaving(true)
    try {
      const response = await fetch(`/api/time-entries/${editingEntry.id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            clock_in_approved_at: clockInIso,
            clock_out_approved_at: clockOutIso,
            edit_reason: adjustmentReason,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update time entry')
      }

      setEditingEntry(null)
      setAdjustmentReason('')
      if (onRefresh) onRefresh()
    } catch (error) {
      console.error('Error updating time entry:', error)
      alert('Failed to update time entry')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateTimeEntry = async () => {
    if (!createDate || !createClockInHour || !createClockInMinute || !createClockOutHour || !createClockOutMinute || !createReason.trim() || !createEmployeeId.trim()) {
      alert('Please provide employee, date, times, and a reason')
      return
    }

    const buildIso = (dateStr: string, hour: string, minute: string, ampm: 'AM' | 'PM') => {
      const h = Number(hour)
      const m = Number(minute)
      let hour24 = h % 12 + (ampm === 'PM' ? 12 : 0)
      if (ampm === 'AM' && h === 12) hour24 = 0
      const iso = new Date(`${dateStr}T${String(hour24).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}:00`).toISOString()
      return iso
    }

    const clockInIso = buildIso(createDate, createClockInHour, createClockInMinute, createClockInAm)
    const clockOutIso = buildIso(createDate, createClockOutHour, createClockOutMinute, createClockOutAm)

    setIsSaving(true)
    try {
      const response = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: createEmployeeId,
          clock_in_reported_at: clockInIso,
          clock_out_reported_at: clockOutIso,
          edit_reason: createReason,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create time entry')
      }

      setShowCreate(false)
      setCreateDate(todayStr())
      setCreateClockInHour('08')
      setCreateClockInMinute('00')
      setCreateClockOutHour('05')
      setCreateClockOutMinute('00')
      setCreateClockInAm('AM')
      setCreateClockOutAm('PM')
      setCreateReason('')
      setCreateEmployeeId('')
      if (onRefresh) onRefresh()
    } catch (error) {
      console.error('Error creating time entry:', error)
      alert(error instanceof Error ? error.message : 'Failed to create time entry')
    } finally {
      setIsSaving(false)
    }
  }

  const loadAdjustments = async (entryId: string) => {
    setLoadingAdjustments(true)
    try {
      const response = await fetch(`/api/time-entries/${entryId}/adjustments`)
      if (response.ok) {
        const data = await response.json()
        setAdjustments(data.adjustments || [])
        setShowAdjustments(true)
      }
    } catch (error) {
      console.error('Error loading adjustments:', error)
    } finally {
      setLoadingAdjustments(false)
    }
  }

  const calculateHours = (clockIn: string | null, clockOut: string | null) => {
    if (!clockIn) return '0.00'
    if (!clockOut) {
      // Currently clocked in - will be shown with live component
      return null
    }
    const start = new Date(clockIn)
    const end = new Date(clockOut)
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    return hours.toFixed(2)
  }

  const getDetailedStatus = (entry: TimeEntry) => {
    // Check granular approval state
    const clockInApproved = !!entry.clock_in_approved_at
    const clockOutReported = !!entry.clock_out_reported_at
    const clockOutApproved = !!entry.clock_out_approved_at

    if (entry.status === 'rejected') {
      return { label: 'Rejected', color: 'bg-red-900 bg-opacity-50 text-red-200 border border-red-700' }
    }

    if (entry.status === 'approved') {
      // Fully approved (both clock-in and clock-out)
      return { label: 'Approved', color: 'bg-green-900 bg-opacity-50 text-green-200 border border-green-700' }
    }

    if (entry.status === 'pending_approval') {
      if (clockInApproved && clockOutReported && !clockOutApproved) {
        // Clock-in approved, but clock-out needs approval
        return { label: 'Clock-Out Needs Approval', color: 'bg-red-900 bg-opacity-50 text-red-200 border border-red-700' }
      }
      // Normal pending approval (both need approval)
      return { label: 'Pending Approval', color: 'bg-yellow-900 bg-opacity-50 text-yellow-200 border border-yellow-700' }
    }

    if (entry.status === 'pending_clock_in') {
      if (clockInApproved) {
        // Clock-in approved, still working
        return { label: 'Approved (Working)', color: 'bg-green-900 bg-opacity-50 text-green-200 border border-green-700' }
      }
      // Still clocked in, not approved yet
      return { label: 'Currently Clocked In', color: 'bg-blue-900 bg-opacity-50 text-blue-200 border border-blue-700' }
    }

    return { label: 'Unknown', color: 'bg-gray-700 text-gray-300 border border-gray-600' }
  }

  if (timeEntries.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center">
        <p className="text-gray-400">No time entries found for the selected filters</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header with Export */}
      <div className="bg-gray-900 px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-white">Time Entries History</h3>
          <p className="text-xs text-gray-400 mt-1">{timeEntries.length} entries</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowCreate(true)}
            className="text-sm"
          >
            + Add Entry
          </Button>
          <button
            onClick={onExportCSV}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Clock In</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Clock Out</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Hours</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Job</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
            {timeEntries.map((entry) => {
              const employeeName = entry.employee?.profile?.full_name || 'Unknown'
              const jobTitle = entry.schedule?.job?.title || '-'
              const approverName = entry.approver?.full_name || '-'
              // Use approved times if available, otherwise fall back to reported times
              const clockIn = entry.clock_in_approved_at || entry.clock_in_reported_at
              const clockOut = entry.clock_out_approved_at || entry.clock_out_reported_at
              const hours = calculateHours(clockIn, clockOut)

              return (
                <tr key={entry.id}>
                  <td className="px-4 py-4">
                    <div className="text-sm font-medium text-white">{employeeName}</div>
                    <div className="text-xs text-gray-400">{entry.employee?.profile?.email}</div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-300">
                    {format(new Date(entry.clock_in_reported_at), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-4">
                    {entry.clock_in_approved_at ? (
                      <>
                        <div className="text-sm text-gray-300">
                          {format(new Date(entry.clock_in_approved_at), 'h:mm a')}
                        </div>
                        {entry.clock_in_approved_at !== entry.clock_in_reported_at && (
                          <div className="text-xs text-orange-400">
                            (Reported: {format(new Date(entry.clock_in_reported_at), 'h:mm a')})
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-sm text-gray-300">
                        {format(new Date(entry.clock_in_reported_at), 'h:mm a')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {entry.clock_out_approved_at ? (
                      <>
                        <div className="text-sm text-gray-300">
                          {format(new Date(entry.clock_out_approved_at), 'h:mm a')}
                        </div>
                        {entry.clock_out_reported_at &&
                          entry.clock_out_approved_at !== entry.clock_out_reported_at && (
                            <div className="text-xs text-orange-400">
                              (Reported: {format(new Date(entry.clock_out_reported_at), 'h:mm a')})
                            </div>
                          )}
                      </>
                    ) : entry.clock_out_reported_at ? (
                      <div className="text-sm text-gray-300">
                        {format(new Date(entry.clock_out_reported_at), 'h:mm a')}
                      </div>
                    ) : (
                      <span className="text-sm text-yellow-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold text-white">
                    {hours !== null ? (
                      `${hours}h`
                    ) : (
                      <LiveHoursDisplay clockIn={clockIn} />
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-300">{jobTitle}</td>
                  <td className="px-4 py-4">
                    {(() => {
                      const statusInfo = getDetailedStatus(entry)
                      return (
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col items-start gap-2">
                      <button
                        onClick={() => openEditDialog(entry)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded hover:bg-blue-500/10 transition-colors"
                        title="Edit time"
                      >
                        <Edit2 className="h-3 w-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => loadAdjustments(entry.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs text-gray-400 hover:text-gray-300 border border-gray-500/30 rounded hover:bg-gray-500/10 transition-colors"
                        title="View adjustment history"
                      >
                        <History className="h-3 w-3" />
                        History
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Create Entry Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Time Entry</DialogTitle>
            <DialogDescription>Enter approved times and a reason for the manual entry.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
          <div className="space-y-1">
              <label className="text-sm text-gray-300">Employee *</label>
              <Select
                value={createEmployeeId}
                onValueChange={(val) => setCreateEmployeeId(val)}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Search employees..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input
                      placeholder="Type to search..."
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                      className="bg-gray-900 border-gray-700 text-sm text-white"
                    />
                  </div>
                  {employees
                    .filter((emp) =>
                      emp.name.toLowerCase().includes(employeeSearch.toLowerCase())
                    )
                    .map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-300">Work Date *</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-gray-900 border-gray-700 text-white hover:bg-gray-800 hover:text-white",
                      !createDate && "text-gray-400"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {createDate ? format(new Date(createDate), "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-gray-900 border-gray-700" align="start">
                  <Calendar
                    mode="single"
                    selected={new Date(createDate)}
                    onSelect={(date) => {
                      if (date) {
                        setCreateDate(date.toISOString().split('T')[0])
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm text-gray-300">Clock In *</label>
                <div className="flex items-center gap-2 max-w-xs">
                  <Select value={createClockInHour} onValueChange={setCreateClockInHour}>
                    <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-gray-400">:</span>
                  <Select value={createClockInMinute} onValueChange={setCreateClockInMinute}>
                    <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateClockInAm(createClockInAm === 'AM' ? 'PM' : 'AM')}
                    className="w-16"
                  >
                    {createClockInAm}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-300">Clock Out *</label>
                <div className="flex items-center gap-2 max-w-xs">
                  <Select value={createClockOutHour} onValueChange={setCreateClockOutHour}>
                    <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-gray-400">:</span>
                  <Select value={createClockOutMinute} onValueChange={setCreateClockOutMinute}>
                    <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateClockOutAm(createClockOutAm === 'AM' ? 'PM' : 'AM')}
                    className="w-16"
                  >
                    {createClockOutAm}
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-gray-300">Reason *</label>
              <textarea
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm"
                rows={3}
                value={createReason}
                onChange={(e) => setCreateReason(e.target.value)}
                placeholder="Why are you adding this entry?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleCreateTimeEntry} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Summary Footer */}
      <div className="bg-gray-900 px-4 py-3 border-t border-gray-700">
        <div className="flex justify-end gap-8 text-sm">
          <div>
            <span className="text-gray-400">Total Hours: </span>
            <span className="font-semibold text-white">
              {timeEntries
                .reduce((sum, entry) => {
                  const clockIn = entry.clock_in_approved_at || entry.clock_in_reported_at
                  const clockOut = entry.clock_out_approved_at || entry.clock_out_reported_at
                  const hours = calculateHours(clockIn, clockOut)
                  if (hours === null) return sum // Skip currently clocked-in entries
                  const parsed = parseFloat(hours)
                  return sum + (isNaN(parsed) ? 0 : parsed)
                }, 0)
                .toFixed(2)}
              h
            </span>
          </div>
        </div>
      </div>

      {/* Edit Time Entry Dialog */}
      <Dialog open={!!editingEntry} onOpenChange={() => setEditingEntry(null)}>
        <DialogContent className="bg-gray-800 text-white border-gray-700">
          <DialogHeader>
            <DialogTitle>Edit Time Entry</DialogTitle>
            <DialogDescription className="text-gray-400">
              Adjust clock in/out times for {editingEntry?.employee?.profile?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Work Date
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-gray-900 border-gray-700 text-white hover:bg-gray-800 hover:text-white",
                      !newDate && "text-gray-400"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newDate ? format(new Date(newDate), "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-gray-900 border-gray-700" align="start">
                  <Calendar
                    mode="single"
                    selected={newDate ? new Date(newDate) : new Date()}
                    onSelect={(date) => {
                      if (date) {
                        setNewDate(date.toISOString().split('T')[0])
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Clock In Time
                </label>
                <div className="flex items-center gap-2 max-w-xs">
                  <Select value={newClockInHour} onValueChange={setNewClockInHour}>
                    <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-gray-400">:</span>
                  <Select value={newClockInMinute} onValueChange={setNewClockInMinute}>
                    <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewClockInAm(newClockInAm === 'AM' ? 'PM' : 'AM')}
                    className="w-16"
                  >
                    {newClockInAm}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Clock Out Time
                </label>
                <div className="flex items-center gap-2 max-w-xs">
                  <Select value={newClockOutHour} onValueChange={setNewClockOutHour}>
                    <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-gray-400">:</span>
                  <Select value={newClockOutMinute} onValueChange={setNewClockOutMinute}>
                    <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewClockOutAm(newClockOutAm === 'AM' ? 'PM' : 'AM')}
                    className="w-16"
                  >
                    {newClockOutAm}
                  </Button>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Reason for Adjustment <span className="text-red-400">*</span>
              </label>
              <textarea
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                placeholder="Explain why you're adjusting this time entry..."
                rows={3}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingEntry(null)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={isSaving || !adjustmentReason.trim()}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjustments History Dialog */}
      <Dialog open={showAdjustments} onOpenChange={() => setShowAdjustments(false)}>
        <DialogContent className="bg-gray-800 text-white border-gray-700 max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Time Entry Adjustment History</DialogTitle>
            <DialogDescription className="text-gray-400">
              All modifications made to this time entry
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {loadingAdjustments ? (
              <div className="text-center py-8 text-gray-400">Loading...</div>
            ) : adjustments.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No adjustments found</div>
            ) : (
              <div className="space-y-4">
                {adjustments.map((adj) => (
                  <div key={adj.id} className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-sm font-medium text-white">
                          Adjusted by {adj.adjusted_by.full_name}
                        </div>
                        <div className="text-xs text-gray-400">
                          {format(new Date(adj.adjusted_at), 'MMM d, yyyy h:mm a')}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <div className="text-xs font-medium text-gray-400 mb-1">Clock In</div>
                        <div className="text-sm text-red-400">
                          Before: {adj.original_clock_in ? format(new Date(adj.original_clock_in), 'h:mm a') : '-'}
                        </div>
                        <div className="text-sm text-green-400">
                          After: {adj.new_clock_in ? format(new Date(adj.new_clock_in), 'h:mm a') : '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-gray-400 mb-1">Clock Out</div>
                        <div className="text-sm text-red-400">
                          Before: {adj.original_clock_out ? format(new Date(adj.original_clock_out), 'h:mm a') : '-'}
                        </div>
                        <div className="text-sm text-green-400">
                          After: {adj.new_clock_out ? format(new Date(adj.new_clock_out), 'h:mm a') : '-'}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-400 mb-1">Reason</div>
                      <div className="text-sm text-gray-300">{adj.adjustment_reason}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowAdjustments(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
