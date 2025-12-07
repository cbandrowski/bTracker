'use client'

import { useEffect, useId, useRef } from 'react'

export interface ParsedAddress {
  address: string
  city: string
  state: string
  zipcode: string
  country: string
  addressLine2?: string
  place?: google.maps.places.PlaceResult
}

interface AddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onPlaceSelected: (place: ParsedAddress) => void
  placeholder?: string
  className?: string
  label?: string
  required?: boolean
}

const parseAddressComponents = (
  components: google.maps.GeocoderAddressComponent[]
) => {
  let streetNumber = ''
  let route = ''
  let city = ''
  let state = ''
  let zipcode = ''
  let zipcodeSuffix = ''
  let country = 'USA'
  let subpremise = ''
  let county = ''
  let neighborhood = ''

  components.forEach(component => {
    const types = component.types || []
    const longText = component.long_name
    const shortText = component.short_name

    if (types.includes('street_number')) streetNumber = longText
    if (types.includes('route')) route = longText
    if (types.includes('locality')) city = longText
    if (types.includes('postal_town')) city = city || longText
    if (types.includes('sublocality') || types.includes('sublocality_level_1')) city = city || longText
    if (types.includes('administrative_area_level_2')) county = longText
    if (types.includes('neighborhood')) neighborhood = longText
    if (types.includes('administrative_area_level_1')) state = shortText
    if (types.includes('postal_code')) zipcode = longText
    if (types.includes('postal_code_suffix')) zipcodeSuffix = longText
    if (types.includes('country')) country = shortText === 'US' ? 'USA' : longText
    if (types.includes('subpremise')) subpremise = longText
  })

  const resolvedCity = city || neighborhood || county
  const resolvedZipcode = zipcodeSuffix ? `${zipcode}-${zipcodeSuffix}` : zipcode
  const streetAddress = `${streetNumber} ${route}`.trim()

  return {
    address: streetAddress,
    city: resolvedCity,
    state,
    zipcode: resolvedZipcode,
    country,
    addressLine2: subpremise ? `Unit ${subpremise}` : undefined,
  }
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
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const onChangeRef = useRef(onChange)
  const onPlaceSelectedRef = useRef(onPlaceSelected)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onPlaceSelectedRef.current = onPlaceSelected
  }, [onPlaceSelected])

  useEffect(() => {
    let cancelled = false

    const setup = async () => {
      if (cancelled || typeof window === 'undefined' || !inputRef.current) return

      try {
        console.log('[AddressAutocomplete] Starting setup with standard Autocomplete...')

        // Wait for Google Maps API to be ready
        if (!window.google?.maps?.places) {
          await window.google?.maps.importLibrary('places')
        }

        if (cancelled || !inputRef.current) return

        console.log('[AddressAutocomplete] Creating Autocomplete instance...')

        // Create autocomplete instance
        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: 'us' },
          fields: ['address_components', 'formatted_address', 'name'],
          types: ['address']
        })

        autocompleteRef.current = autocomplete

        console.log('[AddressAutocomplete] Adding place_changed listener...')

        // Listen for place selection
        autocomplete.addListener('place_changed', () => {
          console.log('[AddressAutocomplete] place_changed event fired!')

          const place = autocomplete.getPlace()
          console.log('[AddressAutocomplete] Place data:', place)

          if (!place.address_components) {
            console.log('[AddressAutocomplete] No address components in place')
            return
          }

          const parsedBase = parseAddressComponents(place.address_components)
          console.log('[AddressAutocomplete] Parsed address:', parsedBase)

          const resolvedAddress = parsedBase.address || place.formatted_address || ''

          const parsed: ParsedAddress = {
            ...parsedBase,
            address: resolvedAddress,
            place,
          }

          console.log('[AddressAutocomplete] Final parsed address:', parsed)
          console.log('🏠 Billing address parsed from Google:', parsed)

          // Update the input value
          if (inputRef.current) {
            inputRef.current.value = resolvedAddress
          }

          onChangeRef.current(resolvedAddress)
          onPlaceSelectedRef.current(parsed)
        })

        console.log('[AddressAutocomplete] Setup complete!')

      } catch (error) {
        console.error('[AddressAutocomplete] Setup error:', error)
      }
    }

    void setup()

    return () => {
      cancelled = true
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current)
        autocompleteRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value
    }
  }, [value])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    console.log('[AddressAutocomplete] Input changed:', newValue)
    onChange(newValue)
  }

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700" htmlFor={inputId}>
          {label}
          {required && ' *'}
        </label>
      )}
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        defaultValue={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        required={required}
        className={className}
        autoComplete="off"
      />
    </div>
  )
}
