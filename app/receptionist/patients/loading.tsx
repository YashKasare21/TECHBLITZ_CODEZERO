import {
  SkeletonPageHeader,
  SkeletonFilterBar,
  SkeletonTable,
} from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader hasButton />
      <SkeletonFilterBar cols={2} />
      <SkeletonTable rows={10} cols={5} />
    </div>
  );
}
