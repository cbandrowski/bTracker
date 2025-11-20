'use client'

import { useState } from 'react'
import { Customer, UpdateCustomerInput } from '@/types/customer-details'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/useToast'
import { useRouter } from 'next/navigation'

interface CustomerInfoPanelProps {
  customer: Customer
}

export function CustomerInfoPanel({ customer: initialCustomer }: CustomerInfoPanelProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [customer, setCustomer] = useState<Customer>(initialCustomer)
  const [formData, setFormData] = useState<UpdateCustomerInput>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const handleEdit = () => {
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      billing_address: customer.billing_address,
      billing_address_line_2: customer.billing_address_line_2,
      billing_city: customer.billing_city,
      billing_state: customer.billing_state,
      billing_zipcode: customer.billing_zipcode,
      billing_country: customer.billing_country,
      service_address: customer.service_address,
      service_address_line_2: customer.service_address_line_2,
      service_city: customer.service_city,
      service_state: customer.service_state,
      service_zipcode: customer.service_zipcode,
      service_country: customer.service_country,
      same_as_billing: customer.same_as_billing,
      notes: customer.notes,
    })
    setIsEditing(true)
  }

  const handleCancel = () => {
    setFormData({})
    setIsEditing(false)
  }

  const handleSave = async () => {
    try {
      setIsSubmitting(true)

      const response = await fetch(`/api/customers/${customer.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update customer')
      }

      const updatedCustomer = await response.json()
      setCustomer(updatedCustomer)
      setIsEditing(false)

      toast({
        variant: 'success',
        title: 'Customer updated',
        description: 'Customer information has been updated successfully',
      })

      // Refresh the page to update all data
      router.refresh()
    } catch (error) {
      console.error('Error updating customer:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update customer',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateFormField = <K extends keyof UpdateCustomerInput>(
    field: K,
    value: UpdateCustomerInput[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (!isEditing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customer Information</CardTitle>
          <CardDescription>Contact and address details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</p>
            <p className="text-base text-gray-900 dark:text-white">{customer.name}</p>
          </div>

          {customer.phone && (
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Phone</p>
              <p className="text-base text-gray-900 dark:text-white">{customer.phone}</p>
            </div>
          )}

          {customer.email && (
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</p>
              <p className="text-base text-gray-900 dark:text-white">{customer.email}</p>
            </div>
          )}

          {(customer.billing_address || customer.billing_city) && (
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Billing Address</p>
              <div className="text-base text-gray-900 dark:text-white">
                {customer.billing_address && <div>{customer.billing_address}</div>}
                {customer.billing_address_line_2 && <div>{customer.billing_address_line_2}</div>}
                {(customer.billing_city || customer.billing_state || customer.billing_zipcode) && (
                  <div>
                    {customer.billing_city}
                    {customer.billing_city && customer.billing_state && ', '}
                    {customer.billing_state} {customer.billing_zipcode}
                  </div>
                )}
                {customer.billing_country && customer.billing_country !== 'USA' && (
                  <div>{customer.billing_country}</div>
                )}
              </div>
            </div>
          )}

          {!customer.same_as_billing && (customer.service_address || customer.service_city) && (
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Service Address</p>
              <div className="text-base text-gray-900 dark:text-white">
                {customer.service_address && <div>{customer.service_address}</div>}
                {customer.service_address_line_2 && <div>{customer.service_address_line_2}</div>}
                {(customer.service_city || customer.service_state || customer.service_zipcode) && (
                  <div>
                    {customer.service_city}
                    {customer.service_city && customer.service_state && ', '}
                    {customer.service_state} {customer.service_zipcode}
                  </div>
                )}
                {customer.service_country && customer.service_country !== 'USA' && (
                  <div>{customer.service_country}</div>
                )}
              </div>
            </div>
          )}

          {customer.notes && (
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Notes</p>
              <p className="text-base text-gray-900 dark:text-white whitespace-pre-wrap">
                {customer.notes}
              </p>
            </div>
          )}

          <Button onClick={handleEdit} className="w-full mt-4">
            Edit Information
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Customer Information</CardTitle>
        <CardDescription>Update contact and address details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={formData.name || ''}
            onChange={e => updateFormField('name', e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone || ''}
            onChange={e => updateFormField('phone', e.target.value || null)}
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email || ''}
            onChange={e => updateFormField('email', e.target.value || null)}
            disabled={isSubmitting}
          />
        </div>

        <div className="pt-2">
          <h3 className="text-sm font-medium mb-3">Billing Address</h3>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="billing_address">Street Address</Label>
              <Input
                id="billing_address"
                value={formData.billing_address || ''}
                onChange={e => updateFormField('billing_address', e.target.value || null)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="billing_address_line_2">Address Line 2</Label>
              <Input
                id="billing_address_line_2"
                value={formData.billing_address_line_2 || ''}
                onChange={e => updateFormField('billing_address_line_2', e.target.value || null)}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="billing_city">City</Label>
                <Input
                  id="billing_city"
                  value={formData.billing_city || ''}
                  onChange={e => updateFormField('billing_city', e.target.value || null)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billing_state">State</Label>
                <Input
                  id="billing_state"
                  value={formData.billing_state || ''}
                  onChange={e => updateFormField('billing_state', e.target.value || null)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="billing_zipcode">ZIP Code</Label>
              <Input
                id="billing_zipcode"
                value={formData.billing_zipcode || ''}
                onChange={e => updateFormField('billing_zipcode', e.target.value || null)}
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Internal Notes</Label>
          <Textarea
            id="notes"
            rows={4}
            value={formData.notes || ''}
            onChange={e => updateFormField('notes', e.target.value || null)}
            disabled={isSubmitting}
            placeholder="Add any internal notes about this customer..."
          />
        </div>

        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleSave}
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
