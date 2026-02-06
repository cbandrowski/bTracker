'use client'

import { useState } from 'react'
import { MailPlus, Shield } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useOwnerManagement } from '@/hooks/useOwnerManagement'
import { OwnerList } from '@/components/Owners/OwnerList'
import { OwnerRequestsTable } from '@/components/Owners/OwnerRequestsTable'

export default function OwnersPage() {
  const { profile } = useAuth()
  const {
    owners,
    requests,
    loading,
    error,
    createRequest,
    approveRequest,
    rejectRequest,
    cancelRequest,
    finalizeRequest,
  } = useOwnerManagement()

  const [email, setEmail] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleAddOwner = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!email.trim()) return

    setSubmitting(true)
    setActionError(null)

    try {
      await createRequest({
        action: 'add_owner',
        target_email: email.trim(),
      })
      setEmail('')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to request new owner')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRequestRemoval = async (profileId: string) => {
    setSubmitting(true)
    setActionError(null)

    try {
      await createRequest({
        action: 'remove_owner',
        target_profile_id: profileId,
      })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to request removal')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-amber-400" />
        <div>
          <h2 className="text-2xl font-semibold text-white">Owners</h2>
          <p className="text-sm text-purple-200">
            Manage shared ownership with approval and transparency.
          </p>
        </div>
      </div>

      {(error || actionError) && (
        <div className="p-4 rounded-lg border border-red-500/40 bg-red-900/30 text-red-200">
          {actionError || error}
        </div>
      )}

      <div className="bg-slate-900/40 border border-purple-500/30 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <MailPlus className="h-5 w-5 text-amber-300" />
          <h3 className="text-lg font-semibold text-white">Add a New Owner</h3>
        </div>
        <form onSubmit={handleAddOwner} className="flex flex-col md:flex-row gap-3">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="owner@email.com"
            className="flex-1 px-4 py-2 rounded-lg bg-slate-900/70 border border-purple-500/30 text-white"
            required
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-amber-500/80 text-white font-semibold hover:bg-amber-500 disabled:opacity-60"
            disabled={submitting}
          >
            Request Approval
          </button>
        </form>
      </div>

      <div className="bg-slate-900/40 border border-purple-500/30 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Current Owners</h3>
        {loading ? (
          <div className="text-sm text-purple-200">Loading owners...</div>
        ) : (
          <OwnerList
            owners={owners}
            currentProfileId={profile?.id ?? null}
            onRequestRemoval={handleRequestRemoval}
          />
        )}
      </div>

      <div className="bg-slate-900/40 border border-purple-500/30 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Owner Change Requests</h3>
        {loading ? (
          <div className="text-sm text-purple-200">Loading requests...</div>
        ) : (
          <OwnerRequestsTable
            requests={requests}
            currentProfileId={profile?.id ?? null}
            onApprove={approveRequest}
            onReject={rejectRequest}
            onCancel={cancelRequest}
            onFinalize={finalizeRequest}
          />
        )}
      </div>
    </div>
  )
}
