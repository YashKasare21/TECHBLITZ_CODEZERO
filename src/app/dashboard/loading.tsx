/**
 * Dashboard loading skeleton
 * Shown while dashboard data is being fetched
 */
export default function DashboardLoading() {
  return (
    <div className="container mx-auto p-6">
      {/* Title skeleton */}
      <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-6" />

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-4 rounded-lg shadow">
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Appointments list skeleton */}
      <div className="bg-white rounded-lg shadow">
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse p-4 border-b" />
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <div className="space-y-2">
                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-48 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="h-6 w-20 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
