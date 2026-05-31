import { FileCheck, FileWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface WaiverBadgeProps {
  status?: string | null;
  className?: string;
}

export default function WaiverBadge({ status, className }: WaiverBadgeProps) {
  const signed = status === "signed";
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium gap-1",
        signed
          ? "bg-green-50 text-green-700 border-green-200"
          : "bg-amber-50 text-amber-700 border-amber-200",
        className,
      )}
    >
      {signed ? <FileCheck className="h-3 w-3" /> : <FileWarning className="h-3 w-3" />}
      {signed ? "Waiver signed" : "Waiver pending"}
    </Badge>
  );
}
