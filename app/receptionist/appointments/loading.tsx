import {
  SkeletonPageHeader,
  SkeletonFilterBar,
  SkeletonTable,
} from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader hasButton />
      <SkeletonFilterBar cols={4} />
      <SkeletonTable rows={10} cols={6} />
    </div>
  );
}
