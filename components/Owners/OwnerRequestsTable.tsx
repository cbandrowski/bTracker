'use client'

import { OwnerChangeRequestWithDetails } from '@/hooks/useOwnerManagement'

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-200',
  approved: 'bg-emerald-500/20 text-emerald-200',
  rejected: 'bg-red-500/20 text-red-200',
  cancelled: 'bg-slate-500/20 text-slate-200',
  executed: 'bg-purple-500/20 text-purple-200',
  expired: 'bg-slate-500/20 text-slate-200',
}

type OwnerRequestsTableProps = {
  requests: OwnerChangeRequestWithDetails[]
  currentProfileId: string | null
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onCancel: (id: string) => void
  onFinalize: (id: string) => void
}

export function OwnerRequestsTable({
  requests,
  currentProfileId,
  onApprove,
  onReject,
  onCancel,
  onFinalize,
}: OwnerRequestsTableProps) {
  if (requests.length === 0) {
    return (
      <div className="text-sm text-purple-200">No owner change requests yet.</div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-purple-100">
        <thead>
          <tr className="text-left border-b border-purple-500/30">
            <th className="py-3 px-2 font-semibold">Action</th>
            <th className="py-3 px-2 font-semibold">Target</th>
            <th className="py-3 px-2 font-semibold">Requested By</th>
            <th className="py-3 px-2 font-semibold">Approvals</th>
            <th className="py-3 px-2 font-semibold">Status</th>
            <th className="py-3 px-2 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => {
            const approvals = request.approvals || []
            const approvalCount = approvals.filter((approval) => approval.decision === 'approve').length
            const rejectionCount = approvals.filter((approval) => approval.decision === 'reject').length
            const requester = request.created_by_profile?.full_name || request.created_by_profile?.email || 'Unknown'
            const target = request.target_profile?.full_name || request.target_profile?.email || 'Unknown'
            const statusClass = statusStyles[request.status] || 'bg-slate-500/20 text-slate-200'
            const userDecision = approvals.find(
              (approval) => approval.approver_profile_id === currentProfileId
            )

            const canApprove =
              request.status === 'pending' &&
              currentProfileId &&
              request.created_by !== currentProfileId &&
              !userDecision

            const canReject = canApprove

            const canCancel =
              currentProfileId &&
              request.created_by === currentProfileId &&
              (request.status === 'pending' || request.status === 'approved')

            const effectiveAt = request.effective_at ? new Date(request.effective_at) : null
            const canFinalize =
              request.status === 'approved' &&
              request.action === 'remove_owner' &&
              (!effectiveAt || effectiveAt.getTime() <= Date.now())

            return (
              <tr key={request.id} className="border-b border-purple-500/10">
                <td className="py-3 px-2 font-medium text-white">
                  {request.action === 'add_owner' ? 'Add Owner' : 'Remove Owner'}
                </td>
                <td className="py-3 px-2 text-purple-200">{target}</td>
                <td className="py-3 px-2 text-purple-200">{requester}</td>
                <td className="py-3 px-2 text-purple-200">
                  {approvalCount}/{request.required_approvals}
                  {rejectionCount > 0 ? ' (rejected)' : ''}
                </td>
                <td className="py-3 px-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${statusClass}`}>
                    {request.status}
                  </span>
                  {request.status === 'approved' && request.action === 'remove_owner' && effectiveAt ? (
                    <div className="text-xs text-purple-300 mt-1">
                      Cooldown until {effectiveAt.toLocaleString()}
                    </div>
                  ) : null}
                </td>
                <td className="py-3 px-2">
                  <div className="flex flex-wrap gap-2">
                    {canApprove && (
                      <button
                        type="button"
                        onClick={() => onApprove(request.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/80 text-white hover:bg-emerald-600"
                      >
                        Approve
                      </button>
                    )}
                    {canReject && (
                      <button
                        type="button"
                        onClick={() => onReject(request.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600/80 text-white hover:bg-red-600"
                      >
                        Reject
                      </button>
                    )}
                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => onCancel(request.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-600/80 text-white hover:bg-slate-600"
                      >
                        Cancel
                      </button>
                    )}
                    {canFinalize && (
                      <button
                        type="button"
                        onClick={() => onFinalize(request.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600/80 text-white hover:bg-purple-600"
                      >
                        Finalize
                      </button>
                    )}
                    {!canApprove && !canReject && !canCancel && !canFinalize && (
                      <span className="text-xs text-purple-300">No actions</span>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
