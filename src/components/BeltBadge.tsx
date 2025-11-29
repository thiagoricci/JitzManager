import { Badge } from "@/components/ui/badge";

export type BeltRank = "white" | "blue" | "purple" | "brown" | "black";

interface BeltBadgeProps {
  rank: BeltRank;
  className?: string;
}

const beltConfig = {
  white: { label: "White Belt", color: "bg-slate-100 text-slate-900 border-slate-300" },
  blue: { label: "Blue Belt", color: "bg-blue-500 text-white" },
  purple: { label: "Purple Belt", color: "bg-purple-600 text-white" },
  brown: { label: "Brown Belt", color: "bg-amber-800 text-white" },
  black: { label: "Black Belt", color: "bg-slate-900 text-white" },
};

export default function BeltBadge({ rank, className }: BeltBadgeProps) {
  const config = beltConfig[rank];
  
  return (
    <Badge variant="outline" className={`${config.color} ${className}`}>
      {config.label}
    </Badge>
  );
}
