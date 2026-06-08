import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
}

export default function StatCard({ title, value, icon: Icon, trend, trendUp }: StatCardProps) {
  return (
    <Card className="overflow-hidden transition-all hover:shadow-lg">
      <CardContent className="p-3 md:p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 md:space-y-1 min-w-0">
            <p className="text-xs md:text-sm font-medium text-muted-foreground truncate">{title}</p>
            <h3 className="text-xl md:text-3xl font-bold text-foreground">{value}</h3>
            {trend && (
              <p className={`text-xs md:text-sm ${trendUp ? "text-accent" : "text-muted-foreground"} truncate`}>
                {trend}
              </p>
            )}
          </div>
          <div className="flex h-9 w-9 md:h-12 md:w-12 items-center justify-center rounded-lg md:rounded-xl bg-primary/15 shrink-0">
            <Icon className="h-4 w-4 md:h-6 md:w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
