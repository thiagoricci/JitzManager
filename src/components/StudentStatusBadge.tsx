import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StudentStatusBadgeProps {
  status: string | null;
  membershipStatus: string | null;
  variant?: "outline" | "filled";
  className?: string;
}

export default function StudentStatusBadge({
  status,
  membershipStatus,
  variant = "outline",
  className,
}: StudentStatusBadgeProps) {
  const isActive = status === "student" && membershipStatus === "active";
  const isInactive = membershipStatus === "inactive";
  const isFrozen = membershipStatus === "frozen";
  const isTrial = status === "trial" && !isInactive && !isFrozen;
  const isNone = (status === "none" || !status) && !isActive && !isInactive && !isFrozen;

  const label =
    isInactive ? "Inactive"
    : isFrozen ? "Frozen"
    : isActive ? "Active"
    : isTrial ? "Trial"
    : isNone ? "None"
    : "-";

  const colorClasses =
    variant === "filled"
      ? cn(
          isActive && "bg-green-500 text-white hover:bg-green-600",
          isTrial && "bg-blue-500 text-white hover:bg-blue-600",
          isNone && "bg-gray-400 text-white hover:bg-gray-500",
          isFrozen && "bg-yellow-500 text-white hover:bg-yellow-600",
          isInactive && "bg-gray-500 text-white hover:bg-gray-600"
        )
      : cn(
          isActive && "bg-green-50 text-green-700 border-green-200",
          isInactive && "bg-gray-100 text-gray-600 border-gray-200",
          isFrozen && "bg-amber-50 text-amber-700 border-amber-200",
          isTrial && "bg-blue-50 text-blue-700 border-blue-200",
          isNone && "bg-gray-50 text-gray-500 border-gray-200"
        );

  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-medium", colorClasses, className)}
    >
      {label}
    </Badge>
  );
}
