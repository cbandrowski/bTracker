'use client'

import { useMemo, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useApprovals } from '@/hooks/useApprovals'
import { useOwnerManagement } from '@/hooks/useOwnerManagement'
import { ApprovalRequestsTable } from '@/components/Approvals/ApprovalRequestsTable'
import { OwnerRequestsTable } from '@/components/Owners/OwnerRequestsTable'
import { ApprovalRequestStatus } from '@/types/database'

export default function ApprovalsPage() {
  const { profile } = useAuth()
  const [statusFilter, setStatusFilter] = useState<ApprovalRequestStatus | 'all'>('pending')

  const approvals = useApprovals(statusFilter)
  const ownerManagement = useOwnerManagement()

  const pendingOwnerRequests = useMemo(
    () => ownerManagement.requests.filter((request) => request.status === 'pending'),
    [ownerManagement.requests]
  )

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-amber-400" />
        <div>
          <h2 className="text-2xl font-semibold text-white">Approvals Center</h2>
          <p className="text-sm text-purple-200">
            Review sensitive owner actions before they take effect.
          </p>
        </div>
      </div>

      <div className="bg-slate-900/40 border border-purple-500/30 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs text-purple-200 mb-1">Approval Filter</label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as ApprovalRequestStatus | 'all')}
              className="w-full px-3 py-2 rounded-lg bg-slate-900/70 border border-purple-500/30 text-white"
            >
              <option value="pending">Pending</option>
              <option value="all">All</option>
              <option value="approved">Approved</option>
              <option value="applied">Applied</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/40 border border-purple-500/30 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Operational Approvals</h3>
          <span className="text-xs text-purple-300">
            {approvals.requests.length} request{approvals.requests.length === 1 ? '' : 's'}
          </span>
        </div>

        {approvals.error && (
          <div className="p-4 rounded-lg border border-red-500/40 bg-red-900/30 text-red-200">
            {approvals.error}
          </div>
        )}

        {approvals.loading ? (
          <div className="text-sm text-purple-200">Loading approvals...</div>
        ) : (
          <ApprovalRequestsTable
            requests={approvals.requests}
            currentProfileId={profile?.id || null}
            onApprove={approvals.approveRequest}
            onReject={approvals.rejectRequest}
            onCancel={approvals.cancelRequest}
          />
        )}
      </div>

      <div className="bg-slate-900/40 border border-purple-500/30 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Owner Change Approvals</h3>
          <span className="text-xs text-purple-300">
            {pendingOwnerRequests.length} pending request{pendingOwnerRequests.length === 1 ? '' : 's'}
          </span>
        </div>

        {ownerManagement.error && (
          <div className="p-4 rounded-lg border border-red-500/40 bg-red-900/30 text-red-200">
            {ownerManagement.error}
          </div>
        )}

        {ownerManagement.loading ? (
          <div className="text-sm text-purple-200">Loading owner approvals...</div>
        ) : (
          <OwnerRequestsTable
            requests={ownerManagement.requests}
            currentProfileId={profile?.id || null}
            onApprove={ownerManagement.approveRequest}
            onReject={ownerManagement.rejectRequest}
            onCancel={ownerManagement.cancelRequest}
            onFinalize={ownerManagement.finalizeRequest}
          />
        )}
      </div>
    </div>
  )
}
