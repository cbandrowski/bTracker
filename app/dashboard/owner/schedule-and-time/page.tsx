/**
 * Main Schedule & Time Management Page
 * Redirects to Schedule tab by default
 */

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ScheduleAndTimePage() {
  const router = useRouter()

  useEffect(() => {
    router.push('/dashboard/owner/schedule-and-time/schedule-shifts')
  }, [router])

  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-gray-400">Loading...</div>
    </div>
  )
}
