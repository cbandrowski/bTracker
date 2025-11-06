'use client'

import { useEffect, useRef } from 'react'

interface AddressComponents {
  address: string
  city: string
  state: string
  zipcode: string
  country: string
}

interface AddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onPlaceSelected: (components: AddressComponents) => void
  placeholder?: string
  className?: string
  label?: string
  required?: boolean
}

export default function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder = 'Enter address',
  className = '',
  label,
  required = false,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

  useEffect(() => {
    if (!inputRef.current || typeof window === 'undefined' || !window.google) {
      return
    }

    // Initialize autocomplete
    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'us' },
      fields: ['address_components', 'formatted_address'],
      types: ['address'],
    })

    // Listen for place selection
    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current?.getPlace()
      if (!place || !place.address_components) {
        return
      }

      const components: AddressComponents = {
        address: '',
        city: '',
        state: '',
        zipcode: '',
        country: 'USA',
      }

      let streetNumber = ''
      let route = ''

      // Parse address components
      place.address_components.forEach((component) => {
        const types = component.types

        if (types.includes('street_number')) {
          streetNumber = component.long_name
        }
        if (types.includes('route')) {
          route = component.long_name
        }
        if (types.includes('locality')) {
          components.city = component.long_name
        }
        if (types.includes('administrative_area_level_1')) {
          components.state = component.short_name
        }
        if (types.includes('postal_code')) {
          components.zipcode = component.long_name
        }
        if (types.includes('country')) {
          components.country = component.short_name === 'US' ? 'USA' : component.long_name
        }
      })

      // Combine street number and route for full address
      components.address = `${streetNumber} ${route}`.trim()

      // Update the input value
      onChange(components.address)

      // Call the callback with parsed components
      onPlaceSelected(components)
    })

    // Cleanup
    return () => {
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
    }
  }, [onPlaceSelected, onChange])

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && ' *'}
        </label>
      )}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className={className || "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"}
      />
    </div>
  )
}
