'use client'

import { OwnerWithProfile } from '@/hooks/useOwnerManagement'

type OwnerListProps = {
  owners: OwnerWithProfile[]
  currentProfileId: string | null
  onRequestRemoval: (profileId: string) => void
}

export function OwnerList({ owners, currentProfileId, onRequestRemoval }: OwnerListProps) {
  if (owners.length === 0) {
    return (
      <div className="text-sm text-purple-200">No owners found.</div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-purple-100">
        <thead>
          <tr className="text-left border-b border-purple-500/30">
            <th className="py-3 px-2 font-semibold">Owner</th>
            <th className="py-3 px-2 font-semibold">Email</th>
            <th className="py-3 px-2 font-semibold">Primary</th>
            <th className="py-3 px-2 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {owners.map((owner) => {
            const name = owner.profile?.full_name || owner.profile?.email || 'Unknown'
            const email = owner.profile?.email || '—'
            const isPrimary = owner.is_primary_owner
            const isSelf = currentProfileId === owner.profile_id

            return (
              <tr key={owner.id} className="border-b border-purple-500/10">
                <td className="py-3 px-2 font-medium text-white">{name}</td>
                <td className="py-3 px-2 text-purple-200">{email}</td>
                <td className="py-3 px-2">
                  {isPrimary ? (
                    <span className="px-2 py-1 rounded-full text-xs bg-amber-500/20 text-amber-200">
                      Primary
                    </span>
                  ) : (
                    <span className="text-purple-300 text-xs">No</span>
                  )}
                </td>
                <td className="py-3 px-2">
                  <button
                    type="button"
                    onClick={() => onRequestRemoval(owner.profile_id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600/80 text-white hover:bg-red-600 disabled:opacity-50"
                    disabled={!owner.profile_id}
                  >
                    {isSelf ? 'Request My Removal' : 'Request Removal'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
