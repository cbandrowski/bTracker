'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface MenuItem {
  label: string
  link: string
  icon: React.ReactNode
}

interface OwnerSidebarProps {
  menu: MenuItem[]
}

export function OwnerSidebar({ menu }: OwnerSidebarProps) {
  const pathname = usePathname()

  return (
    <div className="w-64 flex-shrink-0">
      <div className="bg-gray-900 shadow-lg rounded-lg border border-gray-800 overflow-hidden h-full">
        <nav className="space-y-1 p-2">
          {menu.map((item) => {
            const isActive = pathname === item.link

            return (
              <Link
                key={item.link}
                href={item.link}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span className="mr-3 h-5 w-5 flex items-center justify-center">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
