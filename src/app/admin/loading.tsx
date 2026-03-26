// src/app/admin/loading.tsx
export default function AdminLoading() {
  return (
    <div className="animate-in fade-in duration-500">
      {/* Header skeleton */}
      <div className="mb-10">
        <div className="h-9 w-48 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse mb-3" />
        <div className="h-4 w-64 bg-gray-100 dark:bg-gray-900 rounded-lg animate-pulse" />
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        <div className="h-32 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 animate-pulse p-6">
          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-2xl mb-4" />
          <div className="h-4 w-2/3 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        </div>
        <div className="h-32 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 animate-pulse p-6">
          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-2xl mb-4" />
          <div className="h-4 w-1/2 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        </div>
        <div className="h-32 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 animate-pulse p-6 hidden lg:block">
          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-2xl mb-4" />
          <div className="h-4 w-3/4 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        </div>
      </div>

      {/* Table/List skeleton */}
      <div className="space-y-4">
        <div className="h-20 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 animate-pulse flex items-center px-6 gap-4">
          <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/4 bg-gray-100 dark:bg-gray-800 rounded-lg" />
            <div className="h-3 w-1/2 bg-gray-50 dark:bg-gray-950 rounded-lg" />
          </div>
        </div>
        <div className="h-20 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 animate-pulse flex items-center px-6 gap-4">
          <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 bg-gray-100 dark:bg-gray-800 rounded-lg" />
            <div className="h-3 w-1/4 bg-gray-50 dark:bg-gray-950 rounded-lg" />
          </div>
        </div>
        <div className="h-20 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 animate-pulse flex items-center px-6 gap-4">
          <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/2 bg-gray-100 dark:bg-gray-800 rounded-lg" />
            <div className="h-3 w-1/3 bg-gray-50 dark:bg-gray-950 rounded-lg" />
          </div>
        </div>
      </div>
      
      {/* Premium Gradient Shimmer Overlay */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent -translate-x-full animate-shimmer skew-x-12" />
      </div>
    </div>
  );
}
