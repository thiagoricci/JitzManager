import { Users, TrendingUp, Award, Calendar } from "lucide-react";
import StatCard from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import BeltBadge, { BeltRank } from "@/components/BeltBadge";

// Mock data
const recentStudents = [
  { id: 1, name: "Carlos Silva", belt: "blue" as BeltRank, joinDate: "2024-01-15" },
  { id: 2, name: "Ana Santos", belt: "white" as BeltRank, joinDate: "2024-01-20" },
  { id: 3, name: "Pedro Costa", belt: "purple" as BeltRank, joinDate: "2024-01-22" },
  { id: 4, name: "Maria Oliveira", belt: "white" as BeltRank, joinDate: "2024-01-25" },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h2>
        <p className="text-muted-foreground">Overview of your academy</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Students"
          value={48}
          icon={Users}
          trend="+12% from last month"
          trendUp
        />
        <StatCard
          title="Active This Week"
          value={36}
          icon={TrendingUp}
          trend="75% attendance"
          trendUp
        />
        <StatCard
          title="Belt Promotions"
          value={5}
          icon={Award}
          trend="This quarter"
        />
        <StatCard
          title="Classes This Week"
          value={12}
          icon={Calendar}
          trend="4 more scheduled"
        />
      </div>

      {/* Recent Students */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Students</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentStudents.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between rounded-lg border border-border p-4 transition-all hover:border-primary/50 hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                    {student.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{student.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Joined {new Date(student.joinDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <BeltBadge rank={student.belt} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
