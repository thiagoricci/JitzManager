import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Seo } from "@/lib/seo";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import BeltBadge, { BeltRank } from "@/components/BeltBadge";
import { Input } from "@/components/ui/input";
import { Search, CheckCircle2, Clock, AlertCircle, Settings } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDate, getTodayInTimezone, getDayOfWeekInTimezone } from "@/lib/date";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function Attendance() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [checkInBefore, setCheckInBefore] = useState("15");
  const [checkInAfter, setCheckInAfter] = useState("10");
  const [attendanceToDelete, setAttendanceToDelete] = useState<number | null>(null);
  const { user, profile, organization } = useAuth();
  const queryClient = useQueryClient();
  
  // Use organization timezone or default to UTC
  const timezone = organization?.timezone || "UTC";
  const today = getTodayInTimezone(timezone);
  const currentDayOfWeek = getDayOfWeekInTimezone(timezone);

  // Fetch organization settings
  const { data: orgSettings } = useQuery({
    queryKey: ["organization", profile?.organization_id],
    enabled: !!profile?.organization_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("check_in_minutes_before, check_in_minutes_after")
        .eq("id", profile?.organization_id)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  // Update local state when settings are loaded
  useEffect(() => {
    if (orgSettings) {
      setCheckInBefore(orgSettings.check_in_minutes_before?.toString() || "15");
      setCheckInAfter(orgSettings.check_in_minutes_after?.toString() || "10");
    }
  }, [orgSettings]);

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (values: { before: number; after: number }) => {
      if (!profile?.organization_id) throw new Error("Organization not found");

      const { error } = await supabase
        .from("organizations")
        .update({
          check_in_minutes_before: values.before,
          check_in_minutes_after: values.after,
        })
        .eq("id", profile.organization_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", profile?.organization_id] });
      toast.success("Attendance settings updated");
      setIsSettingsOpen(false);
    },
    onError: (error) => {
      toast.error(`Error updating settings: ${error.message}`);
    },
  });

  // Delete attendance mutation
  const deleteAttendanceMutation = useMutation({
    mutationFn: async (attendanceId: number) => {
      const { error } = await supabase
        .from("attendance")
        .delete()
        .eq("id", attendanceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", today, currentClass?.id] });
      toast.success("Student checked out successfully");
      setAttendanceToDelete(null);
    },
    onError: (error) => {
      toast.error(`Error checking out: ${error.message}`);
    },
  });

  const handleSaveSettings = () => {
    const before = parseInt(checkInBefore);
    const after = parseInt(checkInAfter);

    if (isNaN(before) || isNaN(after) || before < 0 || after < 0) {
      toast.error("Please enter valid positive numbers");
      return;
    }

    updateSettingsMutation.mutate({ before, after });
  };

  const handleCheckOut = (attendanceId: number) => {
    if (profile?.role === "owner" || profile?.role === "admin") {
      setAttendanceToDelete(attendanceId);
    }
  };

  // Fetch all active students
  const { data: students, isLoading: isLoadingStudents } = useQuery({
    queryKey: ["students", "active", organization?.id],
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("organization_id", organization!.id)
        .eq("status", "student")
        .eq("membership_status", "active")
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch today's schedules
  const { data: todaysSchedules } = useQuery({
    queryKey: ["schedules", currentDayOfWeek, organization?.id],
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .eq("organization_id", organization!.id)
        .eq("day_of_week", currentDayOfWeek)
        .order("start_time");
      
      if (error) throw error;
      return data;
    },
  });

  // Determine current class
  const getCurrentClass = () => {
    if (!todaysSchedules) return null;
    
    // Get current time in organization's timezone
    const now = new Date();
    // We need to get the hours/minutes in the target timezone
    // Since we don't have a direct "getTimeInTimezone" helper that returns minutes,
    // we can format the time in the timezone and parse it back.
    // Or better, use toZonedTime from date-fns-tz if we imported it here,
    // but let's stick to using the Date object adjusted for the timezone offset if possible,
    // or just rely on the server time if we were doing this server-side.
    // For client-side, we can use the Intl API or date-fns-tz.
    // Since we already use date-fns-tz in lib/date.ts, let's assume we can use a similar logic here
    // but for simplicity and to avoid adding more imports/logic here, let's use the helper we created.
    
    // Actually, let's just use the native Date object with toLocaleString for the specific timezone
    const timeString = now.toLocaleTimeString("en-US", {
      timeZone: timezone,
      hour12: false,
      hour: "numeric",
      minute: "numeric"
    });
    const [hours, minutes] = timeString.split(":").map(Number);
    const currentTime = hours * 60 + minutes;

    const minsBefore = orgSettings?.check_in_minutes_before ?? 15;
    const minsAfter = orgSettings?.check_in_minutes_after ?? 10;

    return todaysSchedules.find(schedule => {
      const [startHour, startMinute] = schedule.start_time.split(":").map(Number);
      
      const startTime = startHour * 60 + startMinute;
      
      // Allow check-in X mins before class starts until Y mins after start
      return currentTime >= (startTime - minsBefore) && currentTime <= (startTime + minsAfter);
    });
  };

  const currentClass = getCurrentClass();

  // Fetch attendance for current class
  const { data: classAttendance, isLoading: isLoadingAttendance } = useQuery({
    queryKey: ["attendance", today, currentClass?.id, organization?.id],
    enabled: !!currentClass && !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*, students(*)")
        .eq("organization_id", organization!.id)
        .eq("date", today)
        .eq("schedule_id", currentClass.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Check-in mutation
  const checkInMutation = useMutation({
    mutationFn: async (studentId: number) => {
      if (!currentClass) throw new Error("No active class found");

      // Get organization_id from profile first
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user?.id)
        .single();

      if (!profile?.organization_id) throw new Error("Organization not found");

      const { error } = await supabase
        .from("attendance")
        .insert({
          student_id: studentId,
          organization_id: profile.organization_id,
          schedule_id: currentClass.id,
          date: today,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", today, currentClass?.id] });
      toast.success("Student checked in successfully");
    },
    onError: (error) => {
      toast.error(`Error checking in: ${error.message}`);
    },
  });

  const handleCheckIn = (studentId: number) => {
    if (!currentClass) {
      toast.error("No class is currently in session");
      return;
    }

    // Check if already checked in
    const isCheckedIn = classAttendance?.some(
      (record) => record.student_id === studentId
    );

    if (isCheckedIn) {
      toast.error("Student already checked in for this class");
      return;
    }

    checkInMutation.mutate(studentId);
  };

  const filteredStudents = students?.filter((student) =>
    student.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const checkedInStudentIds = new Set(classAttendance?.map(a => a.student_id));

  if (isLoadingStudents) {
    return (
      <div className="space-y-6 h-[calc(100vh-4rem)] flex flex-col">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0">
          <div>
            <Skeleton className="h-9 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-80" />
        </div>
        <Skeleton className="h-20 w-full rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          <Skeleton className="rounded-lg h-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Class Check-in</h2>
          <p className="text-muted-foreground">
            {formatDate(new Date(), timezone, "EEEE, MMMM do, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {(profile?.role === "owner" || profile?.role === "admin") && (
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Attendance Settings</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="before" className="text-right col-span-2">
                      Minutes before class
                    </Label>
                    <Input
                      id="before"
                      type="number"
                      value={checkInBefore}
                      onChange={(e) => setCheckInBefore(e.target.value)}
                      className="col-span-2"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="after" className="text-right col-span-2">
                      Minutes after start
                    </Label>
                    <Input
                      id="after"
                      type="number"
                      value={checkInAfter}
                      onChange={(e) => setCheckInAfter(e.target.value)}
                      className="col-span-2"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button onClick={handleSaveSettings}>Save changes</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {!currentClass ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Active Class</AlertTitle>
          <AlertDescription>
            There are no classes scheduled for this time. Please check the schedule or wait for the next class to start.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
          <h3 className="font-semibold text-primary flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Current Class: {currentClass.name}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {currentClass.start_time.slice(0, 5)} - {currentClass.end_time.slice(0, 5)}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Student Selection Area */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <h3 className="font-semibold mb-4">Select Student to Check In</h3>
          <ScrollArea className="flex-1 pr-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
              {filteredStudents?.map((student) => {
                const isCheckedIn = checkedInStudentIds.has(student.id);
                return (
                  <Card
                    key={student.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      isCheckedIn 
                        ? "opacity-50 bg-muted" 
                        : !currentClass 
                          ? "opacity-50 cursor-not-allowed" 
                          : "hover:border-primary/50"
                    }`}
                    onClick={() => !isCheckedIn && currentClass && handleCheckIn(student.id)}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <Avatar className="h-12 w-12 border-2 border-background">
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">
                          {student.name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{student.name}</p>
                        <BeltBadge rank={student.belt as BeltRank} className="mt-1 scale-90 origin-left" />
                      </div>
                      {isCheckedIn && (
                        <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {filteredStudents?.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  No active students found matching your search.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Checked In List */}
        <div className="bg-muted/30 rounded-lg border p-4 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h3 className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Checked In
            </h3>
            <span className="text-sm font-medium bg-background px-2 py-1 rounded-md border">
              {classAttendance?.length || 0} Students
            </span>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="space-y-3 pr-4">
              {isLoadingAttendance ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 bg-background p-3 rounded-md border">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-24" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {classAttendance?.map((record) => (
                <div
                  key={record.id}
                  className={`flex items-center gap-3 bg-background p-3 rounded-md border shadow-sm ${
                    (profile?.role === "owner" || profile?.role === "admin")
                      ? "cursor-pointer hover:bg-muted/50 transition-colors"
                      : ""
                  }`}
                  onClick={() => handleCheckOut(record.id)}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {record.students?.name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {record.students?.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <BeltBadge rank={record.students?.belt as BeltRank} className="scale-75 origin-left" />
                      <span className="flex items-center gap-1 ml-auto">
                        <Clock className="h-3 w-3" />
                        {formatDate(record.created_at, timezone, "h:mm a")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {classAttendance?.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {currentClass
                    ? "No students checked in yet for this class."
                    : "No active class session."}
                </div>
              )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <AlertDialog open={!!attendanceToDelete} onOpenChange={(open) => !open && setAttendanceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Check Out Student?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the student from the current class attendance list. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => attendanceToDelete && deleteAttendanceMutation.mutate(attendanceToDelete)}>
              Check Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}