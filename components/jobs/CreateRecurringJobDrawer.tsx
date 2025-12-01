'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Calendar as CalendarIcon, Repeat } from 'lucide-react'
import { format } from 'date-fns'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface CreateRecurringJobDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId?: string
  customerName?: string
  onSuccess: () => void
}

const DAYS_OF_WEEK = [
  { label: 'S', value: 0, name: 'Sunday' },
  { label: 'M', value: 1, name: 'Monday' },
  { label: 'T', value: 2, name: 'Tuesday' },
  { label: 'W', value: 3, name: 'Wednesday' },
  { label: 'T', value: 4, name: 'Thursday' },
  { label: 'F', value: 5, name: 'Friday' },
  { label: 'S', value: 6, name: 'Saturday' },
]

export function CreateRecurringJobDrawer({
  open,
  onOpenChange,
  customerId,
  customerName,
  onSuccess,
}: CreateRecurringJobDrawerProps) {
  const [formData, setFormData] = useState({
    title: '',
    summary: '',
    estimated_amount: '',
  })

  const [recurringType, setRecurringType] = useState<'days_of_week' | 'date_interval'>('days_of_week')
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [intervalDays, setIntervalDays] = useState('7')
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endType, setEndType] = useState<'end_of_month' | 'specific_date'>('end_of_month')
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      if (!customerId) {
        throw new Error('No customer selected')
      }

      if (!startDate) {
        throw new Error('Please select a start date')
      }

      if (recurringType === 'days_of_week' && selectedDays.length === 0) {
        throw new Error('Please select at least one day of the week')
      }

      if (endType === 'specific_date' && !endDate) {
        throw new Error('Please select an end date')
      }

      const requestBody = {
        customerId,
        title: formData.title,
        summary: formData.summary || undefined,
        estimated_amount: formData.estimated_amount ? parseFloat(formData.estimated_amount) : undefined,
        recurringType,
        daysOfWeek: recurringType === 'days_of_week' ? selectedDays : undefined,
        intervalDays: recurringType === 'date_interval' ? parseInt(intervalDays) : undefined,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endType,
        endDate: endType === 'specific_date' && endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
      }

      const response = await fetch('/api/jobs/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create recurring jobs')
      }

      // Reset form
      setFormData({
        title: '',
        summary: '',
        estimated_amount: '',
      })
      setRecurringType('days_of_week')
      setSelectedDays([])
      setIntervalDays('7')
      setStartDate(undefined)
      setEndType('end_of_month')
      setEndDate(undefined)

      onSuccess()
      onOpenChange(false)

      // Show success message
      alert(`Created ${data.count} recurring job instances!`)
    } catch (err) {
      console.error('Error creating recurring jobs:', err)
      setError(err instanceof Error ? err.message : 'Failed to create recurring jobs')
    } finally {
      setSubmitting(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  // Calculate preview of job count
  const getJobCountPreview = () => {
    if (!startDate) return null

    let calculatedEndDate: Date

    if (endType === 'end_of_month') {
      calculatedEndDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0)
    } else if (endType === 'specific_date' && endDate) {
      calculatedEndDate = endDate
    } else {
      return null
    }

    let count = 0

    if (recurringType === 'days_of_week' && selectedDays.length > 0) {
      let currentDate = new Date(startDate)
      while (currentDate <= calculatedEndDate) {
        if (selectedDays.includes(currentDate.getDay())) {
          count++
        }
        currentDate.setDate(currentDate.getDate() + 1)
      }
    } else if (recurringType === 'date_interval') {
      const interval = parseInt(intervalDays) || 7
      let currentDate = new Date(startDate)
      while (currentDate <= calculatedEndDate) {
        count++
        currentDate.setDate(currentDate.getDate() + interval)
      }
    }

    return count > 0 ? count : null
  }

  const jobCount = getJobCountPreview()

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-3xl mx-auto max-h-[90vh] flex flex-col">
        <DrawerHeader className="flex-shrink-0">
          <DrawerTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5" />
            Create Recurring Jobs
          </DrawerTitle>
          <DrawerDescription>
            {customerName ? `Create recurring jobs for ${customerName}` : 'Create recurring jobs'}
          </DrawerDescription>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-6 overflow-y-auto flex-1">
          {error && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Job Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Job Details</h3>

            <div className="space-y-2">
              <Label htmlFor="title">
                Job Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="e.g., Lawn Maintenance"
                required
              />
              <p className="text-xs text-gray-500">
                Date will be added automatically to each job title
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary">Description</Label>
              <Textarea
                id="summary"
                name="summary"
                value={formData.summary}
                onChange={handleInputChange}
                placeholder="Describe what needs to be done"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimated_amount">Estimated Amount ($)</Label>
              <Input
                id="estimated_amount"
                name="estimated_amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.estimated_amount}
                onChange={handleInputChange}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Recurrence Pattern */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recurrence Pattern</h3>

            <RadioGroup value={recurringType} onValueChange={(value) => setRecurringType(value as 'days_of_week' | 'date_interval')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="days_of_week" id="days_of_week" />
                <Label htmlFor="days_of_week" className="cursor-pointer font-normal">
                  Specific days of the week
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="date_interval" id="date_interval" />
                <Label htmlFor="date_interval" className="cursor-pointer font-normal">
                  Every X days from start date
                </Label>
              </div>
            </RadioGroup>

            {recurringType === 'days_of_week' && (
              <div className="space-y-2">
                <Label>Select Days <span className="text-red-500">*</span></Label>
                <div className="flex gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={cn(
                        'flex-1 h-12 rounded-md border-2 text-sm font-medium transition-colors',
                        selectedDays.includes(day.value)
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
                      )}
                      title={day.name}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                {selectedDays.length > 0 && (
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Selected: {selectedDays.map(d => DAYS_OF_WEEK[d].name).join(', ')}
                  </p>
                )}
              </div>
            )}

            {recurringType === 'date_interval' && (
              <div className="space-y-2">
                <Label htmlFor="intervalDays">Interval (days) <span className="text-red-500">*</span></Label>
                <Input
                  id="intervalDays"
                  type="number"
                  min="1"
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(e.target.value)}
                  placeholder="7"
                />
                <p className="text-xs text-gray-500">
                  Jobs will be created every {intervalDays || '7'} days
                </p>
              </div>
            )}
          </div>

          {/* Date Range */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Date Range</h3>

            <div className="space-y-2">
              <Label>
                Start Date <span className="text-red-500">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !startDate && 'text-gray-500'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'PPP') : 'Pick a start date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-3">
              <Label>End Condition</Label>
              <RadioGroup value={endType} onValueChange={(value) => setEndType(value as 'end_of_month' | 'specific_date')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="end_of_month" id="end_of_month" />
                  <Label htmlFor="end_of_month" className="cursor-pointer font-normal">
                    End of start month
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="specific_date" id="specific_date" />
                  <Label htmlFor="specific_date" className="cursor-pointer font-normal">
                    Specific end date
                  </Label>
                </div>
              </RadioGroup>

              {endType === 'specific_date' && (
                <div className="ml-6">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !endDate && 'text-gray-500'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, 'PPP') : 'Pick an end date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        disabled={(date) => startDate ? date < startDate : false}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          {jobCount !== null && jobCount > 0 && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4 border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
                Preview: This will create <strong>{jobCount}</strong> job{jobCount !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                Each job can be tracked, assigned, and invoiced separately
              </p>
            </div>
          )}

          {jobCount !== null && jobCount > 100 && (
            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-4 border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-300">
                Warning: {jobCount} jobs exceeds the 100 job limit. Please select a shorter date range.
              </p>
            </div>
          )}
        </form>

        <DrawerFooter className="border-t flex-shrink-0">
          <Button
            onClick={handleSubmit}
            disabled={
              submitting ||
              !formData.title ||
              !startDate ||
              (recurringType === 'days_of_week' && selectedDays.length === 0) ||
              (endType === 'specific_date' && !endDate) ||
              (jobCount !== null && jobCount > 100) ||
              jobCount === 0
            }
            className="w-full"
          >
            {submitting ? 'Creating Jobs...' : `Create ${jobCount || ''} Recurring Job${jobCount !== 1 ? 's' : ''}`}
          </Button>
          <DrawerClose asChild>
            <Button variant="outline" disabled={submitting} className="w-full">
              Cancel
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
