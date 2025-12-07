// Google Maps type declarations

declare global {
  interface Window {
    google: typeof google
  }

  namespace google.maps {
    namespace places {
      interface PlacesLibrary {
        PlaceAutocompleteElement: any
      }
    }
  }
}

export {}
