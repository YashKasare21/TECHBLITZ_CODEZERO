import {
  SkeletonPageHeader,
  SkeletonFilterBar,
  SkeletonTable,
} from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonFilterBar cols={2} />
      <SkeletonTable rows={8} cols={4} />
    </div>
  );
}
