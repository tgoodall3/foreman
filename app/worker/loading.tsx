export default function WorkerLoading() {
  return (
    <div className="p-4 max-w-lg mx-auto animate-pulse">
      <div className="h-7 w-32 bg-gray-200 rounded-lg mb-6" />
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="h-4 w-40 bg-gray-200 rounded" />
              <div className="h-5 w-14 bg-gray-100 rounded-full shrink-0" />
            </div>
            <div className="h-3 w-28 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
