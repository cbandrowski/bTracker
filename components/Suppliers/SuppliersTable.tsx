'use client'

import { Supplier } from '@/types/database'
import { Button } from '@/components/ui/button'

interface SuppliersTableProps {
  suppliers: Supplier[]
  onEdit: (supplier: Supplier) => void
}

const formatPhoneNumber = (phone: string | null) => {
  if (!phone) return '—'
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  return phone
}

const formatAddress = (supplier: Supplier) => {
  const parts = [
    supplier.address,
    supplier.address_line_2,
    supplier.city,
    supplier.state,
    supplier.zipcode,
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(', ') : '—'
}

export function SuppliersTable({ suppliers, onEdit }: SuppliersTableProps) {
  if (suppliers.length === 0) {
    return (
      <div className="text-center text-sm text-gray-400 py-10">
        No suppliers yet.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-700 text-sm">
        <thead className="text-xs uppercase text-gray-400">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Label</th>
            <th className="px-3 py-2 text-left font-semibold">Supplier</th>
            <th className="px-3 py-2 text-left font-semibold">Phone</th>
            <th className="px-3 py-2 text-left font-semibold">Address</th>
            <th className="px-3 py-2 text-left font-semibold">Account #</th>
            <th className="px-3 py-2 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {suppliers.map((supplier) => (
            <tr key={supplier.id}>
              <td className="px-3 py-3 text-gray-200">
                {supplier.label || '—'}
              </td>
              <td className="px-3 py-3 text-white font-medium">
                {supplier.name}
              </td>
              <td className="px-3 py-3 text-gray-300">
                {formatPhoneNumber(supplier.phone)}
              </td>
              <td className="px-3 py-3 text-gray-300">
                {formatAddress(supplier)}
              </td>
              <td className="px-3 py-3 text-gray-300">
                {supplier.account_number || '—'}
              </td>
              <td className="px-3 py-3 text-right">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(supplier)}
                >
                  Edit
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
