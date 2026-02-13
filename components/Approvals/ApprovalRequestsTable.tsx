'use client'

import { ApprovalRequestWithDetails } from '@/hooks/useApprovals'

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-200',
  approved: 'bg-emerald-500/20 text-emerald-200',
  applied: 'bg-emerald-500/20 text-emerald-200',
  rejected: 'bg-red-500/20 text-red-200',
  cancelled: 'bg-slate-500/20 text-slate-200',
  failed: 'bg-red-500/20 text-red-200',
}

const actionLabels: Record<string, string> = {
  employee_pay_change: 'Pay Change',
  job_update: 'Job Edit',
  invoice_update: 'Invoice Update',
}

type ApprovalRequestsTableProps = {
  requests: ApprovalRequestWithDetails[]
  currentProfileId: string | null
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onCancel: (id: string) => void
}

export function ApprovalRequestsTable({
  requests,
  currentProfileId,
  onApprove,
  onReject,
  onCancel,
}: ApprovalRequestsTableProps) {
  if (requests.length === 0) {
    return <div className="text-sm text-purple-200">No approval requests found.</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-purple-100">
        <thead>
          <tr className="text-left border-b border-purple-500/30">
            <th className="py-3 px-2 font-semibold">Type</th>
            <th className="py-3 px-2 font-semibold">Entity</th>
            <th className="py-3 px-2 font-semibold">Summary</th>
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
            const requester = request.requested_by_profile?.full_name || request.requested_by_profile?.email || 'Unknown'
            const entity = request.entity_label || request.entity_id
            const statusClass = statusStyles[request.status] || 'bg-slate-500/20 text-slate-200'
            const userDecision = approvals.find(
              (approval) => approval.approver_profile_id === currentProfileId
            )

            const canApprove =
              request.status === 'pending' &&
              currentProfileId &&
              request.requested_by !== currentProfileId &&
              !userDecision

            const canReject = canApprove

            const canCancel =
              currentProfileId &&
              request.requested_by === currentProfileId &&
              request.status === 'pending'

            return (
              <tr key={request.id} className="border-b border-purple-500/10">
                <td className="py-3 px-2 font-medium text-white">
                  {actionLabels[request.action] || request.action}
                </td>
                <td className="py-3 px-2 text-purple-200">{entity}</td>
                <td className="py-3 px-2 text-purple-200">{request.summary || '—'}</td>
                <td className="py-3 px-2 text-purple-200">{requester}</td>
                <td className="py-3 px-2 text-purple-200">
                  {approvalCount}/{request.required_approvals}
                  {rejectionCount > 0 ? ' (rejected)' : ''}
                </td>
                <td className="py-3 px-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${statusClass}`}>
                    {request.status}
                  </span>
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
                    {!canApprove && !canReject && !canCancel && (
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
