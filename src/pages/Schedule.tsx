import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Seo } from "@/lib/seo";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Trash2, Edit } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getDayOfWeekInTimezone } from "@/lib/date";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface ScheduleEntry {
  id: number;
  name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  organization_id: string;
}

const daysOfWeek = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const dayAbbrevs = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const HOUR_HEIGHT = 64;
const GAP_HEIGHT = 24;

const CLASS_COLORS = [
  "bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-300",
  "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
  "bg-violet-500/15 border-violet-500/40 text-violet-700 dark:text-violet-300",
  "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300",
  "bg-rose-500/15 border-rose-500/40 text-rose-700 dark:rose-300",
  "bg-cyan-500/15 border-cyan-500/40 text-cyan-700 dark:text-cyan-300",
  "bg-orange-500/15 border-orange-500/40 text-orange-700 dark:text-orange-300",
  "bg-pink-500/15 border-pink-500/40 text-pink-700 dark:text-pink-300",
];

const addFormSchema = z.object({
  name: z.string().min(1, "Class name is required"),
  days_of_week: z
    .array(z.string())
    .min(1, "At least one day must be selected"),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
});

const editFormSchema = z.object({
  name: z.string().min(1, "Class name is required"),
  day_of_week: z.number(),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
});

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const date = new Date();
  date.setHours(parseInt(hours));
  date.setMinutes(parseInt(minutes));
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function to24(hour12: number, ampm: "AM" | "PM"): number {
  if (ampm === "AM") return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

function to12(h24: number): { hour: number; ampm: "AM" | "PM" } {
  if (h24 === 0) return { hour: 12, ampm: "AM" };
  if (h24 < 12) return { hour: h24, ampm: "AM" };
  if (h24 === 12) return { hour: 12, ampm: "PM" };
  return { hour: h24 - 12, ampm: "PM" };
}

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

export default function Schedule() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleEntry | null>(null);
  const [scheduleToDelete, setScheduleToDelete] = useState<ScheduleEntry | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const { user, organization } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const addForm = useForm<z.infer<typeof addFormSchema>>({
    resolver: zodResolver(addFormSchema),
    defaultValues: {
      name: "",
      days_of_week: ["1"],
      start_time: "18:00",
      end_time: "19:00",
    },
  });

  const editForm = useForm<z.infer<typeof editFormSchema>>({
    resolver: zodResolver(editFormSchema),
  });

  const { data: schedules, isLoading } = useQuery({
    queryKey: ["schedules", organization?.id],
    enabled: !!organization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .eq("organization_id", organization!.id)
        .order("day_of_week")
        .order("start_time");

      if (error) throw error;
      return data;
    },
  });

  const createScheduleMutation = useMutation({
    mutationFn: async (values: z.infer<typeof addFormSchema>) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user?.id)
        .single();

      if (!profile?.organization_id) throw new Error("Organization not found");

      const newSchedules = values.days_of_week.map((day) => ({
        name: values.name,
        day_of_week: parseInt(day, 10),
        start_time: values.start_time,
        end_time: values.end_time,
        organization_id: profile.organization_id,
      }));

      const { error } = await supabase.from("schedules").insert(newSchedules);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Class(es) added successfully");
      setIsAddDialogOpen(false);
      addForm.reset();
    },
    onError: (error) => {
      toast.error(`Error adding class: ${error.message}`);
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("schedules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Class deleted successfully");
    },
    onError: (error) => {
      toast.error(`Error deleting class: ${error.message}`);
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: async (values: z.infer<typeof editFormSchema>) => {
      const { error } = await supabase
        .from("schedules")
        .update({
          name: values.name,
          day_of_week: values.day_of_week,
          start_time: values.start_time,
          end_time: values.end_time,
        })
        .eq("id", selectedSchedule.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Class updated successfully");
      setIsEditDialogOpen(false);
      setSelectedSchedule(null);
    },
    onError: (error) => {
      toast.error(`Error updating class: ${error.message}`);
    },
  });

  const onAddSubmit = (values: z.infer<typeof addFormSchema>) => {
    createScheduleMutation.mutate(values);
  };

  const onEditSubmit = (values: z.infer<typeof editFormSchema>) => {
    updateScheduleMutation.mutate(values);
  };

  const handleEditClick = (schedule: ScheduleEntry) => {
    setSelectedSchedule(schedule);
    editForm.reset({
      name: schedule.name,
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
    });
    setIsEditDialogOpen(true);
  };

  const { rows, hourTop, totalHeight, colorMap } = useMemo(() => {
    const empty = {
      rows: [] as Array<{ type: "hour"; hour: number } | { type: "gap" }>,
      hourTop: new Map<number, number>(),
      totalHeight: 0,
      colorMap: {} as Record<string, number>,
    };
    if (!schedules || schedules.length === 0) return empty;

    // Only show hours that actually contain a class — gap hours with nothing
    // scheduled on any day collapse into a short break instead of empty rows.
    const occupied = new Set<number>();
    schedules.forEach((s: ScheduleEntry) => {
      const startH = parseInt(s.start_time.split(":")[0], 10);
      const endH = parseInt(s.end_time.split(":")[0], 10);
      const endM = parseInt(s.end_time.split(":")[1], 10);
      const lastHour = endM > 0 ? endH : endH - 1;
      occupied.add(startH);
      for (let h = startH; h <= lastHour; h++) {
        occupied.add(h);
      }
    });

    const vHours = [...occupied].sort((a, b) => a - b);

    const layoutRows: typeof empty.rows = [];
    const tops = new Map<number, number>();
    let y = 0;
    vHours.forEach((h) => {
      layoutRows.push({ type: "hour", hour: h });
      tops.set(h, y);
      y += HOUR_HEIGHT;
    });

    const uniqueNames = [...new Set(schedules.map((s: ScheduleEntry) => s.name))];
    const cMap: Record<string, number> = {};
    uniqueNames.forEach((name, i) => {
      cMap[name] = i % CLASS_COLORS.length;
    });

    return { rows: layoutRows, hourTop: tops, totalHeight: y, colorMap: cMap };
  }, [schedules]);

  // Pixel offset of an hour's row top (a class's hours are contiguous, so no
  // gap ever falls inside a single block).
  const getHourTop = (hour: number): number => hourTop.get(hour) ?? 0;

  const todayDayOfWeek = getDayOfWeekInTimezone(organization?.timezone);

  const schedulesByDay = useMemo(() => {
    const map: Record<number, ScheduleEntry[]> = {};
    for (let d = 0; d <= 6; d++) {
      map[d] = [];
    }
    schedules?.forEach((s: ScheduleEntry) => {
      map[s.day_of_week] = map[s.day_of_week] || [];
      map[s.day_of_week].push(s);
    });
    return map;
  }, [schedules]);

  if (isLoading) return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="rounded-lg border bg-card">
        <Skeleton className="h-9 w-full rounded-t-lg" />
        <Skeleton className="h-64 w-full rounded-b-lg" />
      </div>
    </div>
  );

  return (
    <>
    <Seo title="Schedule" />
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Class Schedule
          </h2>
          <p className="text-sm text-muted-foreground">Manage your weekly class schedule</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Class
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Class</DialogTitle>
              <DialogDescription>
                Set up a new class in your weekly schedule.
              </DialogDescription>
            </DialogHeader>
            <Form {...addForm}>
              <form
                onSubmit={addForm.handleSubmit(onAddSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={addForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Class Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Fundamentals, Advanced Gi"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addForm.control}
                  name="days_of_week"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Days of Week</FormLabel>
                      <FormControl>
                        <ToggleGroup
                          type="multiple"
                          variant="outline"
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex-wrap"
                        >
                          {daysOfWeek.map((day, index) => (
                            <ToggleGroupItem
                              key={index}
                              value={index.toString()}
                              aria-label={`Select ${day}`}
                            >
                              {day.substring(0, 3)}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={addForm.control}
                    name="start_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Start time" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TIME_OPTIONS.map((t) => (
                              <SelectItem key={t} value={t}>
                                {formatTime(t)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="end_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Time</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="End time" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TIME_OPTIONS.map((t) => (
                              <SelectItem key={t} value={t}>
                                {formatTime(t)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={createScheduleMutation.isPending}
                  >
                    {createScheduleMutation.isPending ? "Adding..." : "Add Class"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Mobile: Day selector + list view */}
      {isMobile && (
        <div className="space-y-3">
          <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
            {dayAbbrevs.map((day, i) => {
              const daySchedules = schedulesByDay[i] || [];
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(selectedDay === i ? null : i)}
                  className={cn(
                    "flex flex-col items-center px-3 py-2 rounded-lg text-xs font-medium shrink-0 transition-colors",
                    selectedDay === i
                      ? "bg-primary text-primary-foreground"
                      : i === todayDayOfWeek
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                    daySchedules.length > 0 && selectedDay !== i && "ring-1 ring-primary/30"
                  )}
                >
                  <span>{day}</span>
                  {daySchedules.length > 0 && (
                    <span className={cn(
                      "mt-0.5 h-1 w-1 rounded-full",
                      selectedDay === i ? "bg-primary-foreground" : "bg-primary"
                    )} />
                  )}
                </button>
              );
            })}
          </div>

          {(selectedDay !== null ? schedulesByDay[selectedDay] || [] : schedules || []).length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              {selectedDay !== null
                ? `No classes on ${daysOfWeek[selectedDay]}s.`
                : "No classes scheduled yet. Add one to get started."}
            </div>
          ) : (
            <div className="space-y-2">
              {(selectedDay !== null
                ? schedulesByDay[selectedDay] || []
                : schedules || []
              ).map((schedule: ScheduleEntry) => {
                const colorIndex = colorMap[schedule.name] ?? 0;
                return (
                  <div
                    key={schedule.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3",
                      CLASS_COLORS[colorIndex].replace("bg-", "bg-").replace("/15", "/10"),
                      "hover:opacity-80 transition-opacity cursor-pointer"
                    )}
                    onClick={() => handleEditClick(schedule)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{schedule.name}</span>
                        {selectedDay === null && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {dayAbbrevs[schedule.day_of_week]}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); handleEditClick(schedule); }}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={(e) => { e.stopPropagation(); setScheduleToDelete(schedule); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Desktop: Weekly calendar grid */}
      {!isMobile && (
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b bg-muted/30">
              <div className="h-9 flex items-center justify-center border-r" />
              {dayAbbrevs.map((day, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-9 flex items-center justify-center text-sm font-medium border-r last:border-r-0",
                    i === todayDayOfWeek
                      ? "text-primary font-semibold bg-primary/5"
                      : "text-muted-foreground"
                  )}
                >
                  {day}
                </div>
              ))}
            </div>

            <div
              className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))]"
              style={{ height: totalHeight }}
            >
              <div className="relative border-r">
                {rows.map((row, i) =>
                  row.type === "gap" ? (
                    <div
                      key={`gap-${i}`}
                      className="flex items-center justify-end pr-2"
                      style={{ height: GAP_HEIGHT }}
                    >
                      <span className="text-[10px] text-muted-foreground/40">⋅⋅⋅</span>
                    </div>
                  ) : (
                    <div
                      key={row.hour}
                      className="border-b flex items-center justify-center"
                      style={{ height: HOUR_HEIGHT }}
                    >
                      <span className="text-[11px] text-muted-foreground leading-none">
                        {row.hour === 0
                          ? "12 AM"
                          : row.hour < 12
                            ? `${row.hour} AM`
                            : row.hour === 12
                              ? "12 PM"
                              : `${row.hour - 12} PM`}
                      </span>
                    </div>
                  )
                )}
              </div>

              {dayAbbrevs.map((_, dayIndex) => {
                const daySchedules = schedulesByDay[dayIndex] || [];

                return (
                  <div
                    key={dayIndex}
                    className={cn(
                      "relative border-r last:border-r-0",
                      dayIndex === todayDayOfWeek && "bg-primary/5"
                    )}
                  >
                    {rows.map((row, i) =>
                      row.type === "gap" ? (
                        <div
                          key={`gap-${i}`}
                          className="bg-muted/20"
                          style={{ height: GAP_HEIGHT }}
                        />
                      ) : (
                        <div
                          key={row.hour}
                          className="border-b border-border/50"
                          style={{ height: HOUR_HEIGHT }}
                        />
                      )
                    )}

                    {daySchedules.map((schedule: ScheduleEntry) => {
                      const startH = parseInt(schedule.start_time.split(":")[0], 10);
                      const startM = parseInt(schedule.start_time.split(":")[1], 10);
                      const endH = parseInt(schedule.end_time.split(":")[0], 10);
                      const endM = parseInt(schedule.end_time.split(":")[1], 10);

                      const lastHour = endM > 0 ? endH : endH - 1;
                      const top = getHourTop(startH) + (startM / 60) * HOUR_HEIGHT;
                      const bottom =
                        getHourTop(lastHour) +
                        ((endM > 0 ? endM : 60) / 60) * HOUR_HEIGHT;
                      const height = bottom - top;
                      const colorIndex = colorMap[schedule.name] ?? 0;

                      return (
                        <DropdownMenu key={schedule.id}>
                          <DropdownMenuTrigger asChild>
                            <button
                              className={cn(
                                "absolute inset-x-1 rounded-md border px-1.5 py-0.5",
                                "text-[11px] font-medium cursor-pointer overflow-hidden",
                                "transition-opacity hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-ring",
                                CLASS_COLORS[colorIndex]
                              )}
                              style={{ top, height: Math.max(height, 20) }}
                            >
                              <span className="block truncate leading-tight font-semibold">
                                {schedule.name}
                              </span>
                              {height >= 36 && (
                                <span className="block truncate opacity-70 text-[10px]">
                                  {formatTime(schedule.start_time)} –{" "}
                                  {formatTime(schedule.end_time)}
                                </span>
                              )}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem
                              onClick={() => handleEditClick(schedule)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setScheduleToDelete(schedule)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {schedules && schedules.length > 0 && (
          <div className="h-12 bg-muted/20 border-t" />
        )}

        {schedules?.length === 0 && (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            No classes scheduled yet. Add one to get started.
          </div>
        )}
      </div>
      )}

      <AlertDialog open={!!scheduleToDelete} onOpenChange={(open) => !open && setScheduleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Class</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">{scheduleToDelete?.name}</span> on {daysOfWeek[scheduleToDelete?.day_of_week ?? 0]}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (scheduleToDelete) deleteScheduleMutation.mutate(scheduleToDelete.id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Class</DialogTitle>
            <DialogDescription>
              Update the details for this class.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(onEditSubmit)}
              className="space-y-4"
            >
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Fundamentals, Advanced Gi"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="day_of_week"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Day of Week</FormLabel>
                    <Select
                      onValueChange={(value) =>
                        field.onChange(parseInt(value, 10))
                      }
                      defaultValue={field.value.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a day" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {daysOfWeek.map((day, index) => (
                          <SelectItem key={index} value={index.toString()}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="start_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Start time" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TIME_OPTIONS.map((t) => (
                            <SelectItem key={t} value={t}>
                              {formatTime(t)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="end_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="End time" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TIME_OPTIONS.map((t) => (
                            <SelectItem key={t} value={t}>
                              {formatTime(t)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateScheduleMutation.isPending}
                >
                  {updateScheduleMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}
