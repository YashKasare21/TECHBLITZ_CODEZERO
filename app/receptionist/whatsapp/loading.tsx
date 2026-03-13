import { SkeletonChatPane } from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <div className="h-[calc(100vh-6rem)]">
      <SkeletonChatPane />
    </div>
  );
}
