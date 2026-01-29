import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function CustomersTableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Location</TableHead>
            <TableHead className="text-right">Billed Balance</TableHead>
            <TableHead className="text-right">Unapplied Credit</TableHead>
            <TableHead className="text-center">Open Invoices</TableHead>
            <TableHead className="text-center">Unbilled Jobs</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(5)].map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <div className="flex flex-col space-y-2">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-3 w-24" />
              </TableCell>
              <TableCell className="text-right">
                <div className="inline-flex items-center">
                  <Skeleton className="h-5 w-20" />
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="inline-flex items-center">
                  <Skeleton className="h-5 w-16" />
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Skeleton className="h-5 w-8 mx-auto" />
              </TableCell>
              <TableCell className="text-center">
                <Skeleton className="h-5 w-8 mx-auto" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="h-8 w-8" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
