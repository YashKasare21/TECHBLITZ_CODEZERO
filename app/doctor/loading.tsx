import {
  SkeletonPageHeader,
  SkeletonTable,
} from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonTable rows={8} cols={5} />
    </div>
  );
}
