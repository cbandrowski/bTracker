
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Menu, X, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { CompanySwitcher } from '@/components/Company/CompanySwitcher'

interface MenuItem {
  label: string
  link: string
  icon: React.ReactNode
}

interface EmployeeSidebarProps {
  menu: MenuItem[]
}

export function EmployeeSidebar({ menu }: EmployeeSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Mobile menu button - floating at bottom right */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed bottom-6 right-6 z-50 bg-gradient-to-r from-cyan-600 to-teal-600 text-white p-4 rounded-full shadow-2xl hover:shadow-cyan-500/50 transition-all hover:scale-110"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Backdrop overlay for mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar - slides in from left on mobile, static on desktop */}
      <div
        className={`
          fixed lg:static
          top-0 left-0
          h-full
          w-72 lg:w-64
          flex-shrink-0
          z-40
          transform lg:transform-none
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="bg-slate-800/95 lg:bg-slate-800/50 backdrop-blur-md shadow-2xl rounded-none lg:rounded-xl border-r lg:border border-cyan-500/30 overflow-hidden h-full">
          {/* Mobile header */}
          <div className="lg:hidden px-4 py-4 border-b border-cyan-500/30">
            <h2 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-400">
              Navigation
            </h2>
          </div>

          <nav className="flex flex-col h-[calc(100%-4rem)] lg:h-full">
            <CompanySwitcher />
            <div className="space-y-1 p-3 overflow-y-auto flex-1">
              {menu.map((item) => {
                const isActive = pathname === item.link

                return (
                  <Link
                    key={item.link}
                    href={item.link}
                    onClick={() => setIsOpen(false)}
                    className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-lg shadow-cyan-500/30'
                        : 'text-cyan-200 hover:bg-cyan-500/10 hover:text-cyan-100'
                    }`}
                  >
                    <span className="mr-3 h-5 w-5 flex items-center justify-center flex-shrink-0">
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                )
              })}
            </div>

            {/* Sign Out button - visible on both mobile and desktop */}
            <div className="p-3 border-t border-cyan-500/30">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all bg-red-600/80 text-white hover:bg-red-600 shadow-lg"
              >
                <LogOut className="mr-3 h-5 w-5 flex-shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          </nav>
        </div>
      </div>
    </>
  )
}
