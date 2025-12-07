'use client'

import { Customer } from '@/types/customer-details'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface CustomerInfoPanelProps {
  customer: Customer
}

export function CustomerInfoPanel({ customer }: CustomerInfoPanelProps) {
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
        </CardContent>
      </Card>
    )
  }
