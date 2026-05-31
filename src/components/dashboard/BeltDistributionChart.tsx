import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const BELT: Record<string, string> = {
  white: "#FFFFFF",
  blue: "#2563EB",
  purple: "#7C3AED",
  brown: "#92400E",
  black: "#18181B",
};

const beltOrder = ["white", "blue", "purple", "brown", "black"];

function dotRing(c: string) {
  if (c === BELT.white) return "0 0 0 2px #6B7280";
  if (c === BELT.black) return "0 0 0 1.5px #D1D5DB";
  return undefined;
}

export default function BeltDistributionChart() {
  const { organization } = useAuth();
  const { data: students, isLoading } = useQuery({
    queryKey: ["students-for-belt-chart"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("belt")
        .eq("organization_id", organization.id)
        .eq("status", "student");
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div>Loading Chart...</div>;
  }

  const beltCounts = students?.reduce(
    (acc, student) => {
      const belt = (student.belt || "white").toLowerCase();
      acc[belt] = (acc[belt] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const maxCount = Math.max(...beltOrder.map((b) => beltCounts?.[b] || 0), 1);

  const chartData = beltOrder.map((b) => ({
      key: b,
      label: b.charAt(0).toUpperCase() + b.slice(1),
      count: beltCounts?.[b] || 0,
      color: BELT[b],
      pct: ((beltCounts?.[b] || 0) / maxCount) * 100,
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Belt Distribution</CardTitle>
      </CardHeader>
      <CardContent className="flex items-end justify-center min-h-[260px] pb-8">
        <div className="flex flex-col gap-5 w-full">
          {chartData.map((b) => {
            const borderColor =
              b.key === "white" ? "#6B7280" : b.key === "black" ? "#D1D5DB" : "transparent";
            return (
              <div key={b.key} className="flex items-center gap-3">
                <span
                  className="h-4 w-4 rounded-full shrink-0"
                  style={{ background: b.color, boxShadow: dotRing(b.color) }}
                />
                <span className="text-sm text-muted-foreground w-[60px] shrink-0">
                  {b.label}
                </span>
                <div className="flex-1 h-4 rounded-full overflow-hidden bg-muted">
                  <div
                    className="h-full rounded-full transition-all duration-500 border"
                    style={{
                      width: `${b.pct}%`,
                      background: b.color,
                      borderColor,
                    }}
                  />
                </div>
                <span className="text-sm font-semibold tabular-nums text-foreground w-8 text-right">
                  {b.count}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
