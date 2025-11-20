'use client'

import { CustomerJob } from '@/types/customer-details'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Eye, Briefcase } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface CustomerJobsTabProps {
  customerId: string
  jobs: CustomerJob[]
}

export function CustomerJobsTab({ customerId, jobs }: CustomerJobsTabProps) {
  const router = useRouter()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getStatusBadge = (status: CustomerJob['status']) => {
    const variants: Record<CustomerJob['status'], { variant: 'default' | 'secondary' | 'outline' | 'destructive', label: string }> = {
      upcoming: { variant: 'secondary', label: 'Scheduled' },
      in_progress: { variant: 'default', label: 'In Progress' },
      done: { variant: 'outline', label: 'Completed' },
      cancelled: { variant: 'destructive', label: 'Cancelled' },
    }

    const { variant, label } = variants[status]
    return <Badge variant={variant}>{label}</Badge>
  }

  const handleNewJob = () => {
    router.push(`/dashboard/owner/jobs/new?customerId=${customerId}`)
  }

  const handleViewJob = (jobId: string) => {
    router.push(`/dashboard/owner/jobs/${jobId}`)
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-6 mb-4">
            <Briefcase className="h-10 w-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No jobs yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center">
            This customer doesn't have any jobs yet. Create one to get started.
          </p>
          <Button onClick={handleNewJob}>
            <Plus className="h-4 w-4 mr-2" />
            Create Job
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Jobs</CardTitle>
            <CardDescription>All jobs for this customer</CardDescription>
          </div>
          <Button onClick={handleNewJob} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Job
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead className="text-right">Est. Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">
                    <div>
                      <div>{job.title}</div>
                      {job.summary && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                          {job.summary}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(job.status)}</TableCell>
                  <TableCell>
                    {formatDate(job.planned_end_date || job.created_at)}
                  </TableCell>
                  <TableCell>
                    {job.assigned_employee?.full_name || (
                      <span className="text-gray-400">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {job.estimated_amount > 0
                      ? formatCurrency(job.estimated_amount)
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewJob(job.id)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
