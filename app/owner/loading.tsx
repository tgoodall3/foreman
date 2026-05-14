export default function OwnerLoading() {
  return (
    <div className="p-4 sm:p-6 max-w-6xl animate-pulse">
      {/* Header */}
      <div className="mb-8">
        <div className="h-8 w-32 bg-gray-200 rounded-lg" />
        <div className="h-4 w-48 bg-gray-100 rounded mt-2" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="h-3 w-20 bg-gray-100 rounded mb-3" />
            <div className="h-7 w-24 bg-gray-200 rounded" />
          </div>
        ))}
      </div>

      {/* Content grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 px-4 py-3.5 flex items-center gap-3">
              <div className="w-8 h-4 bg-gray-100 rounded shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="h-4 w-36 max-w-full bg-gray-200 rounded mb-1.5" />
                <div className="h-3 w-24 bg-gray-100 rounded" />
              </div>
              <div className="hidden sm:flex gap-2 shrink-0">
                <div className="h-5 w-14 bg-gray-100 rounded-full" />
                <div className="h-5 w-16 bg-gray-100 rounded-full" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 px-4 py-3.5">
              <div className="h-4 w-36 bg-gray-200 rounded mb-2" />
              <div className="h-3 w-24 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
