'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'

interface UnpaidJob {
  id: string
  title: string
  description: string | null
  completed_at: string
  estimated_amount: number | null
}

interface UnpaidJobsTableProps {
  jobs: UnpaidJob[]
  loading: boolean
  onCreateInvoice: (jobIds: string[]) => void
}

export function UnpaidJobsTable({ jobs, loading, onCreateInvoice }: UnpaidJobsTableProps) {
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set())

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedJobs(new Set(jobs.map(j => j.id)))
    } else {
      setSelectedJobs(new Set())
    }
  }

  const handleSelectJob = (jobId: string, checked: boolean) => {
    const newSelected = new Set(selectedJobs)
    if (checked) {
      newSelected.add(jobId)
    } else {
      newSelected.delete(jobId)
    }
    setSelectedJobs(newSelected)
  }

  const handleCreateInvoice = () => {
    if (selectedJobs.size > 0) {
      onCreateInvoice(Array.from(selectedJobs))
      setSelectedJobs(new Set())
    }
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return 'N/A'
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
      <div className="text-center py-8">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No unpaid done jobs
        </p>
      </div>
    )
  }

  const allSelected = jobs.length > 0 && selectedJobs.size === jobs.length
  const someSelected = selectedJobs.size > 0 && selectedJobs.size < jobs.length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {selectedJobs.size} of {jobs.length} selected
        </div>
        <Button
          onClick={handleCreateInvoice}
          disabled={selectedJobs.size === 0}
          size="sm"
        >
          Create Invoice ({selectedJobs.size})
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all jobs"
                  className={someSelected ? 'data-[state=checked]:bg-gray-400' : ''}
                />
              </TableHead>
              <TableHead>Job</TableHead>
              <TableHead>Completed At</TableHead>
              <TableHead className="text-right">Est. Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => {
              const isSelected = selectedJobs.has(job.id)
              return (
                <TableRow key={job.id}>
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) =>
                        handleSelectJob(job.id, checked as boolean)
                      }
                      aria-label={`Select ${job.title}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{job.title}</div>
                      {job.description && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {job.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(job.completed_at)}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(job.estimated_amount)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
