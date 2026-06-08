import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Seo } from "@/lib/seo";
import {
  Search,
  Mail,
  Phone,
  MoreHorizontal,
  Upload,
  UsersRound,
  Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, getAvatarColor } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import BeltBadge, { BeltRank } from "@/components/BeltBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { formatDate, getTodayInTimezone } from "@/lib/date";
import { useAuth } from "@/contexts/AuthContext";
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
import ImportStudentsDialog, { StudentImportData } from "@/components/ImportStudentsDialog";
import StudentStatusBadge from "@/components/StudentStatusBadge";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Students() {
  const { organization, can } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({
    key: "join_date",
    direction: "desc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const studentsPerPage = 10;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const deleteStudentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("students").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success("Student deleted successfully");
      setStudentToDelete(null);
    },
    onError: (error) => {
      toast.error(`Error deleting student: ${error.message}`);
    },
  });

  const importStudentsMutation = useMutation({
    mutationFn: async (students: StudentImportData[]) => {
      const studentsToInsert = students.map(student => ({
        name: student.name,
        email: student.email || null,
        phone: student.phone || null,
        status: "none",
        belt: "white",
        stripes: 0,
        join_date: getTodayInTimezone(organization?.timezone),
        organization_id: organization!.id,
      }));

      const { data, error } = await supabase
        .from("students")
        .insert(studentsToInsert);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success("Students imported successfully");
      setIsImportDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Error importing students: ${error.message}`);
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["students", sortConfig, currentPage, searchQuery, organization?.id],
    enabled: !!organization?.id,
    queryFn: async () => {
      const from = (currentPage - 1) * studentsPerPage;
      const to = from + studentsPerPage - 1;

      let query = supabase
        .from("students")
        .select("*, membership_plans(name)", { count: "exact" })
        .eq("organization_id", organization!.id)
        .order(sortConfig.key, { ascending: sortConfig.direction === "asc" })
        .range(from, to);

      if (searchQuery.trim()) {
        query = query.ilike("name", `%${searchQuery.trim()}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { data, count };
    },
  });

  const students = data?.data || [];
  const totalStudents = data?.count || 0;
  const totalPages = Math.ceil(totalStudents / studentsPerPage);

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      const newSort = prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "desc" };
      if (newSort.key !== prev.key) setCurrentPage(1);
      return newSort;
    });
  };

  const renderSortArrow = (key: string) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === "asc" ? "↑" : "↓";
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="pb-4 border-b border-border/60">
          <Skeleton className="h-9 w-36 mb-2" />
          <Skeleton className="h-4 w-52" />
        </div>
        <div className="rounded-md border">
          <div className="p-4 space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-16 ml-4" />
                <div className="ml-auto flex items-center gap-6">
                  <Skeleton className="h-4 w-32 hidden md:block" />
                  <Skeleton className="h-4 w-24 hidden lg:block" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <Seo title="Students" />
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3 md:pb-4 border-b border-border/60">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Students</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage your academy students</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
          {can("manage_students") && (
            <Button variant="outline" onClick={() => setIsImportDialogOpen(true)} className="shrink-0">
              <Upload className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Import</span>
            </Button>
          )}
        </div>
      </div>

      {totalStudents === 0 ? (
        <div className="rounded-md border">
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <UsersRound className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-medium text-foreground">No students yet</p>
              <p className="text-sm text-muted-foreground">
                Get started by adding your first student or importing from a spreadsheet.
              </p>
            </div>
            {can("manage_students") && (
              <div className="flex gap-2 mt-2">
                <Link to="/add-student">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Student
                  </Button>
                </Link>
                <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
      <>
      {isMobile ? (
        <div className="space-y-2">
          {students.map((student) => (
            <div
              key={student.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => navigate(`/student/${student.id}`)}
            >
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold shrink-0",
                getAvatarColor(student.name || "?")
              )}>
                {student.name?.charAt(0) || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-sm">{student.name || "Unknown Student"}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <StudentStatusBadge status={student.status} membershipStatus={student.membership_status} className="text-[10px] px-1.5 py-0 h-5" />
                  {student.phone && (
                    <span className="text-xs text-muted-foreground truncate">{student.phone}</span>
                  )}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => navigate(`/student/${student.id}`)}>
                    View details
                  </DropdownMenuItem>
                  {can("manage_students") && (
                    <>
                      <DropdownMenuItem onClick={() => navigate(`/student/${student.id}/edit`)}>
                        Edit student
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStudentToDelete(student.id);
                        }}
                      >
                        Delete student
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      ) : (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("name")}
              >
                Name {renderSortArrow("name")}
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("membership_status")}
              >
                Status {renderSortArrow("membership_status")}
              </TableHead>
              <TableHead className="hidden md:table-cell">Contact</TableHead>
              <TableHead
                className="hidden lg:table-cell cursor-pointer"
                onClick={() => handleSort("join_date")}
              >
                Join Date {renderSortArrow("join_date")}
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student) => (
              <TableRow
                key={student.id}
                className="cursor-pointer transition-colors"
                onClick={() => navigate(`/student/${student.id}`)}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold",
                      getAvatarColor(student.name || "?")
                    )}>
                      {student.name?.charAt(0) || "?"}
                    </div>
                    {student.name || "Unknown Student"}
                  </div>
                </TableCell>
                <TableCell>
                  <StudentStatusBadge status={student.status} membershipStatus={student.membership_status} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex flex-col text-sm text-muted-foreground">
                    {student.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        <span>{student.email}</span>
                      </div>
                    )}
                    {student.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        <span>{student.phone}</span>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground">
                  {formatDate(student.join_date, organization?.timezone)}
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => navigate(`/student/${student.id}`)}>
                        View details
                      </DropdownMenuItem>
                      {can("manage_students") && (
                        <>
                          <DropdownMenuItem onClick={() => navigate(`/student/${student.id}/edit`)}>
                            Edit student
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setStudentToDelete(student.id);
                            }}
                          >
                            Delete student
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs md:text-sm text-muted-foreground">
          {students.length} of {totalStudents}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            ‹
          </Button>
          {!isMobile && Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((page) => {
              if (totalPages <= 7) return true;
              if (page === 1 || page === totalPages) return true;
              if (Math.abs(page - currentPage) <= 1) return true;
              return false;
            })
            .reduce<(number | "ellipsis")[]>((acc, page, idx, arr) => {
              if (idx > 0) {
                const prev = arr[idx - 1];
                if (page - prev > 1) acc.push("ellipsis");
              }
              acc.push(page);
              return acc;
            }, [])
            .map((item, idx) =>
              item === "ellipsis" ? (
                <span key={`ellipsis-${idx}`} className="px-1 text-sm text-muted-foreground select-none">…</span>
              ) : (
                <Button
                  key={item}
                  variant={currentPage === item ? "default" : "outline"}
                  size="icon"
                  className="h-8 w-8 text-xs"
                  onClick={() => setCurrentPage(item)}
                >
                  {item}
                </Button>
              )
            )}
          {isMobile && (
            <span className="text-xs text-muted-foreground px-1">
              {currentPage}/{totalPages}
            </span>
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
          >
            ›
          </Button>
        </div>
      </div>
      </>
      )}

      <AlertDialog
        onOpenChange={(open) => !open && setStudentToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              student and remove their data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (studentToDelete) {
                  deleteStudentMutation.mutate(studentToDelete);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportStudentsDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        onImport={(students) => importStudentsMutation.mutate(students)}
      />
    </div>
    </>
  );
}
