/**
 * Appointments page loading skeleton
 * Shown while appointments data is being fetched
 */
export default function AppointmentsLoading() {
  return (
    <div className="container mx-auto p-6">
      {/* Header skeleton */}
      <div className="flex justify-between items-center mb-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
      </div>

      {/* Filters skeleton */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex flex-wrap gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1">
              <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
              <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b">
          <div className="flex p-4 bg-gray-50">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-4 w-24 bg-gray-200 rounded animate-pulse mr-8"
              />
            ))}
          </div>
        </div>
        <div className="divide-y">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex p-4 items-center">
              <div className="h-10 w-32 bg-gray-200 rounded animate-pulse mr-8" />
              <div className="h-10 w-32 bg-gray-200 rounded animate-pulse mr-8" />
              <div className="h-10 w-32 bg-gray-200 rounded animate-pulse mr-8" />
              <div className="h-6 w-20 bg-gray-200 rounded animate-pulse mr-8" />
              <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
