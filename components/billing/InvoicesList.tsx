'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Eye, FileText, Loader2, Pencil, Trash } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { EditInvoiceDialog } from './EditInvoiceDialog'
import { invoicesService } from '@/lib/services'
import { useToast } from '@/hooks/useToast'

interface Invoice {
  id: string
  invoice_number: string
  status: string
  due_date: string | null
  total?: number
  total_amount?: number
  deposit_applied?: number
  total_paid?: number
  balance_due?: number
  created_at: string
}

interface InvoicesListProps {
  invoices: Invoice[]
  loading: boolean
  onRefresh?: () => Promise<void> | void
}

export function InvoicesList({ invoices, loading, onRefresh }: InvoicesListProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [editOpen, setEditOpen] = useState(false)
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'default'
      case 'partial':
        return 'outline'
      case 'issued':
        return 'secondary'
      case 'draft':
        return 'secondary'
      case 'void':
      case 'cancelled':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const handleEdit = (invoiceId: string) => {
    setActiveInvoiceId(invoiceId)
    setEditOpen(true)
  }

  const handleSaved = async () => {
    if (onRefresh) {
      await onRefresh()
    }
  }

  const handleDelete = async (invoiceId: string) => {
    const confirmed = window.confirm('Delete this invoice? Applied payments will be released.')
    if (!confirmed) return

    setDeletingId(invoiceId)
    try {
      const response = await invoicesService.delete(invoiceId)
      if (response.error) {
        throw new Error(response.error)
      }
      toast({
        variant: 'success',
        title: 'Invoice deleted',
        description: 'Invoice and related applications removed.',
      })
      if (onRefresh) {
        await onRefresh()
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Unable to delete invoice',
      })
    } finally {
      setDeletingId(null)
    }
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

  if (invoices.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No invoices yet
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid/Applied</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => {
                const total = Number(invoice.total_amount || invoice.total || 0)
                const depositsApplied = Number(invoice.deposit_applied || 0)
                const paymentsApplied = Number(invoice.total_paid || 0)
                const totalApplied = depositsApplied + paymentsApplied
                const balance = Number(invoice.balance_due ?? (total - totalApplied))
                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {invoice.invoice_number}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(invoice.status) as any}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(invoice.due_date)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(total)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(totalApplied)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(balance)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/dashboard/owner/invoices/${invoice.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // TODO: Implement PDF download
                            console.log('Download PDF for', invoice.id)
                          }}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(invoice.id)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(invoice.id)}
                          disabled={deletingId === invoice.id}
                        >
                          {deletingId === invoice.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
      {activeInvoiceId && (
        <EditInvoiceDialog
          invoiceId={activeInvoiceId}
          open={editOpen}
          onOpenChange={(open) => {
            setEditOpen(open)
            if (!open) setActiveInvoiceId(null)
          }}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}
