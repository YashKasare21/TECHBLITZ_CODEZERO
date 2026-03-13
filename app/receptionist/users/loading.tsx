import {
  SkeletonPageHeader,
  SkeletonTable,
} from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader hasButton />
      <SkeletonTable rows={8} cols={4} />
    </div>
  );
}
