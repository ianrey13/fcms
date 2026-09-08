// src/components/ui/SkeletonCard.jsx
import { cn } from '@/lib/utils';

export const SkeletonCard = ({ className, children }) => (
  <div className={cn('animate-pulse bg-white dark:bg-slate-800/80 rounded-xl p-4 border border-slate-200/60 dark:border-slate-700/60', className)}>
    {children}
  </div>
);

export const SkeletonText = ({ className, width = 'w-full' }) => (
  <div className={cn('h-3 bg-slate-200 dark:bg-slate-700 rounded', width, className)} />
);

export const SkeletonTitle = ({ className, width = 'w-1/2' }) => (
  <div className={cn('h-6 bg-slate-200 dark:bg-slate-700 rounded', width, className)} />
);

export const SkeletonStats = ({ count = 4 }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {[...Array(count)].map((_, i) => (
      <SkeletonCard key={i}>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <SkeletonText width="w-16" />
            <SkeletonTitle width="w-12" />
          </div>
          <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-700" />
        </div>
      </SkeletonCard>
    ))}
  </div>
);

export const SkeletonTable = ({ rows = 5, cols = 6 }) => (
  <div className="overflow-hidden border rounded-lg dark:border-slate-700">
    <div className="bg-slate-100 dark:bg-slate-800 p-3 border-b dark:border-slate-700">
      <div className="flex gap-4">
        {[...Array(cols)].map((_, i) => (
          <SkeletonText key={i} width={`w-${Math.floor(80/cols)}%`} className="h-4" />
        ))}
      </div>
    </div>
    {[...Array(rows)].map((_, i) => (
      <div key={i} className="flex gap-4 p-3 border-b dark:border-slate-700">
        {[...Array(cols)].map((_, j) => (
          <SkeletonText key={j} width={`w-${Math.floor(80/cols)}%`} className="h-4" />
        ))}
      </div>
    ))}
  </div>
);

export const SkeletonPage = () => (
  <div className="space-y-6 p-4 md:p-6">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <SkeletonTitle width="w-48" className="h-8" />
        <SkeletonText width="w-64" />
      </div>
      <div className="flex gap-3">
        <div className="h-10 w-24 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        <div className="h-10 w-24 bg-slate-200 dark:bg-slate-700 rounded-xl" />
      </div>
    </div>
    <SkeletonStats count={4} />
    <SkeletonTable rows={5} cols={6} />
  </div>
);