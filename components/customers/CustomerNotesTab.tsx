'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText } from 'lucide-react'

interface CustomerNotesTabProps {
  notes: string | null
}

export function CustomerNotesTab({ notes }: CustomerNotesTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Internal Notes</CardTitle>
        <CardDescription>
          Notes about this customer (also editable in the customer info panel)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {notes ? (
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{notes}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-6 mb-4">
              <FileText className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No notes yet
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              Add notes about this customer by editing their information in the customer info
              panel.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
