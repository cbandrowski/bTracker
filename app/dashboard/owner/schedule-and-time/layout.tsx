/**
 * Schedule & Time Layout
 * Provides consistent tab navigation across all sub-pages
 */

'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function ScheduleAndTimeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Determine current tab from pathname
  const currentTab = pathname.split('/').pop() || 'schedule'

  const tabs = [
    { id: 'schedule', label: 'Schedule', href: '/dashboard/owner/schedule-and-time/schedule' },
    { id: 'approvals', label: 'Approvals', href: '/dashboard/owner/schedule-and-time/approvals' },
    { id: 'time-entries', label: 'Time Entries', href: '/dashboard/owner/schedule-and-time/time-entries' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Schedule & Time</h1>
        <p className="text-gray-400 mt-1">Manage employee schedules and approve time entries</p>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <nav className="flex border-b border-gray-700">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={`
                  px-6 py-4 text-sm font-medium border-b-2 transition-colors
                  ${isActive
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
                  }
                `}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Content */}
      {children}
    </div>
  )
}
