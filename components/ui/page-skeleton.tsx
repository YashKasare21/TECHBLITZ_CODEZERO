import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function SkeletonPageHeader({ hasButton = false }: { hasButton?: boolean }) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div className="space-y-2">
        <Bone className="h-7 w-48" />
        <Bone className="h-4 w-72" />
      </div>
      {hasButton && <Bone className="h-9 w-32" />}
    </div>
  );
}

export function SkeletonFilterBar({ cols = 3 }: { cols?: number }) {
  return (
    <div className="mb-4 flex gap-3">
      <Bone className="h-9 flex-1" />
      {Array.from({ length: cols - 1 }).map((_, i) => (
        <Bone key={i} className="h-9 w-36" />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {/* header */}
      <div className="flex gap-4 border-b border-border bg-muted/40 px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Bone key={i} className={cn("h-4", i === 0 ? "w-32" : "flex-1")} />
        ))}
      </div>
      {/* rows */}
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0"
        >
          {Array.from({ length: cols }).map((_, col) => (
            <Bone
              key={col}
              className={cn(
                "h-4",
                col === 0 ? "w-32" : "flex-1",
                // vary widths slightly for realism
                col % 3 === 2 && "w-20 flex-none"
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonStatCards({ count = 4 }: { count?: number }) {
  return (
    <div className="mb-6 grid gap-4" style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Bone className="h-4 w-24" />
            <Bone className="h-8 w-8 rounded-md" />
          </div>
          <Bone className="h-7 w-16" />
          <Bone className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonChatPane() {
  return (
    <div className="flex h-full overflow-hidden rounded-lg border border-border">
      {/* contact list */}
      <div className="w-72 shrink-0 border-r border-border">
        <div className="border-b border-border p-3">
          <Bone className="h-9 w-full" />
        </div>
        <div className="space-y-0.5 p-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-md p-2">
              <Bone className="h-9 w-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Bone className="h-3.5 w-28" />
                <Bone className="h-3 w-40" />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* chat area */}
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-border p-4">
          <Bone className="h-9 w-9 rounded-full" />
          <div className="space-y-1.5">
            <Bone className="h-4 w-32" />
            <Bone className="h-3 w-20" />
          </div>
        </div>
        <div className="flex-1 space-y-4 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
              <Bone className={cn("h-10 rounded-2xl", i % 2 === 0 ? "w-56" : "w-44")} />
            </div>
          ))}
        </div>
        <div className="border-t border-border p-3">
          <Bone className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
