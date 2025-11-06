'use client'

export default function SchedulePage() {
  return (
    <div className="space-y-6">
      <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Schedule</h2>

        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <svg
              className="mx-auto h-16 w-16 text-blue-500 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <h3 className="text-xl font-semibold text-white mb-2">In Progress</h3>
            <p className="text-gray-400 max-w-md">
              The schedule feature is currently under development. You'll be able to create employee schedules, manage shifts, and view the calendar here.
            </p>
            <div className="mt-6 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Coming Soon
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
