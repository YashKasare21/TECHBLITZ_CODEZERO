import {
  SkeletonPageHeader,
  SkeletonStatCards,
  SkeletonTable,
} from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonStatCards count={4} />
      <SkeletonTable rows={8} cols={5} />
    </div>
  );
}
