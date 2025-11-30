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
      <div className="bg-slate-800/50 backdrop-blur-md shadow-2xl rounded-xl border border-purple-500/30 overflow-hidden h-full">
        <nav className="space-y-1 p-3">
          {menu.map((item) => {
            const isActive = pathname === item.link

            return (
              <Link
                key={item.link}
                href={item.link}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-600 to-purple-600 text-white shadow-lg shadow-purple-500/30'
                    : 'text-purple-200 hover:bg-purple-500/10 hover:text-purple-100'
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
