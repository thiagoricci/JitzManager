import { Users, TrendingUp, UserPlus, UserCheck } from "lucide-react";
import StatCard from "@/components/StatCard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import StudentList from "@/components/dashboard/StudentList";

import StudentGrowthChart from "@/components/dashboard/StudentGrowthChart";
import RevenueChart from "@/components/dashboard/RevenueChart";
import AttendanceChart from "@/components/dashboard/AttendanceChart";
import BeltDistributionChart from "@/components/dashboard/BeltDistributionChart";
import FailedPayments from "@/components/dashboard/FailedPayments";
import { useAuth } from "@/contexts/AuthContext";
import { toZonedTime } from "date-fns-tz";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
 
 export default function Dashboard() {
   const { organization } = useAuth();
   const { data: students, isLoading } = useQuery({
     queryKey: ["students", organization?.id],
     enabled: !!organization?.id,
     queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("organization_id", organization!.id)
        .order("join_date", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="pb-4 border-b border-border/60">
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-xl" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-52 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const timezone = organization?.timezone || "UTC";
  const now = new Date();
  const zonedNow = toZonedTime(now, timezone);
  
  const currentMonth = zonedNow.getMonth();
  const currentYear = zonedNow.getFullYear();
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  // Helper to check if date is in specific month/year
  const isInMonth = (dateStr: string, month: number, year: number) => {
    const date = new Date(dateStr);
    // Treat the stored date string as being in the organization's timezone
    const zonedDate = toZonedTime(date, timezone);
    return zonedDate.getMonth() === month && zonedDate.getFullYear() === year;
  };

  // Helper to check if date is before specific month/year (for cumulative totals)
  const isBeforeOrInMonth = (dateStr: string, month: number, year: number) => {
    const date = new Date(dateStr);
    // Treat the stored date string as being in the organization's timezone
    const zonedDate = toZonedTime(date, timezone);
    if (zonedDate.getFullYear() < year) return true;
    if (zonedDate.getFullYear() === year && zonedDate.getMonth() <= month) return true;
    return false;
  };

  // 1. Total Students (no trials)
  const totalStudentsList = students?.filter(s => s.status === 'student') || [];
  const totalStudentsCount = totalStudentsList.length;
  
  const lastMonthTotalStudentsCount = totalStudentsList.filter(s =>
    isBeforeOrInMonth(s.join_date, lastMonth, lastMonthYear)
  ).length;

  const totalStudentsTrend = lastMonthTotalStudentsCount > 0
    ? Math.round(((totalStudentsCount - lastMonthTotalStudentsCount) / lastMonthTotalStudentsCount) * 100)
    : 0;

  // 2. Active Students (active membership status)
  const activeStudentsList = students?.filter(s => s.status === 'student' && s.membership_status === 'active') || [];
  const activeStudentsCount = activeStudentsList.length;

  // 3. New Students (no trials) - joined this month
  const newStudentsList = students?.filter(s => s.status === 'student' && isInMonth(s.join_date, currentMonth, currentYear)) || [];
  const newStudentsCount = newStudentsList.length;

  // 4. Number of Trials - active trials
  const trialsList = students?.filter(s => s.status === 'trial') || [];
  const trialsCount = trialsList.length;
  
  const newTrialsThisMonthCount = trialsList.filter(s =>
    isInMonth(s.join_date, currentMonth, currentYear)
  ).length;


  // Lists for display
  const recentStudents = students?.filter(s => s.status === 'student') || [];
  const recentTrials = students?.filter(s => s.status === 'trial') || [];
  const frozenStudents = students?.filter(s => s.membership_status === 'frozen') || [];
  const inactiveStudents = students?.filter(s => s.membership_status === 'inactive') || [];

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border/60">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h2>
        <p className="text-muted-foreground mt-1">Overview of your academy</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Students"
          value={totalStudentsCount}
          icon={Users}
          trend={`${totalStudentsTrend > 0 ? '+' : ''}${totalStudentsTrend}% overtime`}
          trendUp={totalStudentsTrend >= 0}
        />
        <StatCard
          title="Active Students"
          value={activeStudentsCount}
          icon={UserCheck}
        />
        <StatCard
          title="New Students"
          value={newStudentsCount}
          icon={UserPlus}
          trend="This Month"
        />
        <StatCard
          title="Active Trials"
          value={trialsCount}
          icon={TrendingUp}
          trend={`${newTrialsThisMonthCount} new this month`}
        />
      </div>

      {/* Failed Payments Alert */}
      <FailedPayments />

      {/* Charts Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <StudentGrowthChart />
        <RevenueChart />
        <AttendanceChart />
        <BeltDistributionChart />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <StudentList
          title="Recent Students"
          students={recentStudents}
          emptyMessage="No recent students"
        />
        <StudentList
          title="Recent Trials"
          students={recentTrials}
          emptyMessage="No active trials"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <StudentList
          title="Frozen Students"
          students={frozenStudents}
          emptyMessage="No frozen students"
        />
        <StudentList
          title="Inactive Students"
          students={inactiveStudents}
          emptyMessage="No inactive students"
        />
      </div>
    </div>
  );
}
