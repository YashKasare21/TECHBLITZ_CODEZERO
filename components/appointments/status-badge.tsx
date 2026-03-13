"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/lib/types";

const statusConfig: Record<
  AppointmentStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "bg-warning/15 text-warning-foreground border-warning/30",
  },
  booked: {
    label: "Booked",
    className: "bg-primary/15 text-primary border-primary/30",
  },
  checked_in: {
    label: "Checked In",
    className: "bg-success/15 text-success border-success/30",
  },
  checked_out: {
    label: "Checked Out",
    className: "bg-muted text-muted-foreground border-border",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
  no_show: {
    label: "No Show",
    className: "bg-secondary/15 text-secondary border-secondary/30",
  },
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={cn("font-medium", config.className)}>
      {config.label}
    </Badge>
  );
}
