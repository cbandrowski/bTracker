'use client'

import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { FileText } from 'lucide-react'

interface UnbilledJob {
  id: string
  title: string
  description: string | null
  completed_at: string
  estimated_amount: number
  customer_id: string
  customer_name: string
  customer_email: string | null
  customer_phone: string | null
}

interface UnbilledJobsTableProps {
  jobs: UnbilledJob[]
  loading: boolean
}

export function UnbilledJobsTable({ jobs, loading }: UnbilledJobsTableProps) {
  const router = useRouter()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatPhoneNumber = (phone: string | null) => {
    if (!phone) return '-'
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    }
    return phone
  }

  const handleRowClick = (customerId: string) => {
    router.push(`/dashboard/owner/billing/customers/${customerId}`)
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-gray-100 p-3 dark:bg-gray-800">
          <FileText className="h-6 w-6 text-gray-400" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">No unbilled jobs</h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          All completed jobs have been invoiced
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Completed Date</TableHead>
            <TableHead className="text-right">Est. Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow
              key={job.id}
              className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
              onClick={() => handleRowClick(job.customer_id)}
            >
              <TableCell>
                <div>
                  <div className="font-medium">{job.title}</div>
                  {job.description && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                      {job.description}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="font-medium text-blue-600 dark:text-blue-400">
                  {job.customer_name}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col text-sm">
                  <span className="text-gray-900 dark:text-gray-100">
                    {job.customer_email || '-'}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {formatPhoneNumber(job.customer_phone)}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {formatDate(job.completed_at)}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Badge variant="outline" className="font-mono">
                  {formatCurrency(job.estimated_amount)}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
