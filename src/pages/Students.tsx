import { useState } from "react";
import {
  Search,
  Mail,
  Phone,
  MoreHorizontal,
  ArrowUpDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import BeltBadge, { BeltRank } from "@/components/BeltBadge";
import { useNavigate } from "react-router-dom";
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
import { formatDate } from "@/lib/date";
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

export default function Students() {
  const { organization } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState({
    key: "join_date",
    direction: "desc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const studentsPerPage = 10;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  const { data, isLoading } = useQuery({
    queryKey: ["students", sortConfig, currentPage, organization?.id],
    enabled: !!organization?.id,
    queryFn: async () => {
      const from = (currentPage - 1) * studentsPerPage;
      const to = from + studentsPerPage - 1;

      const { data, error, count } = await supabase
        .from("students")
        .select("*, membership_plans(name)", { count: "exact" })
        .eq("organization_id", organization!.id)
        .order(sortConfig.key, { ascending: sortConfig.direction === "asc" })
        .range(from, to);

      if (error) throw error;
      return { data, count };
    },
  });

  const students = data?.data || [];
  const totalStudents = data?.count || 0;
  const totalPages = Math.ceil(totalStudents / studentsPerPage);

  const filteredStudents =
    students?.filter((student) =>
      student.name?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "desc" };
    });
  };

  const renderSortArrow = (key: string) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === "asc" ? "↑" : "↓";
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Students</h2>
          <p className="text-muted-foreground">Manage your academy students</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

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
            {filteredStudents.map((student) => (
              <TableRow
                key={student.id}
                className="cursor-pointer"
                onClick={() => navigate(`/student/${student.id}`)}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {student.name?.charAt(0) || "?"}
                    </div>
                    {student.name || "Unknown Student"}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={student.status === "trial" ? "secondary" : student.status === "none" || !student.status ? "secondary" : "default"}
                    className={cn(
                      "text-xs",
                      student.status === "student" &&
                        student.membership_status === "active" &&
                        "bg-green-500 hover:bg-green-600",
                      student.status === "student" &&
                        student.membership_status === "inactive" &&
                        "bg-gray-500 hover:bg-gray-600",
                      student.status === "student" &&
                        student.membership_status === "frozen" &&
                        "bg-yellow-500 hover:bg-yellow-600",
                      student.status === "trial" &&
                        "bg-blue-100 text-blue-800 hover:bg-blue-200",
                      (student.status === "none" || !student.status) &&
                        "bg-gray-100 text-gray-800 hover:bg-gray-200"
                    )}
                  >
                    {student.status === "trial"
                      ? "Trial"
                      : student.status === "none" || !student.status
                      ? "None"
                      : student.membership_status
                      ? student.membership_status.charAt(0).toUpperCase() +
                        student.membership_status.slice(1)
                      : "-"}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex flex-col text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3" />
                      <span>{student.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3" />
                      <span>{student.phone}</span>
                    </div>
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
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {students.length} of {totalStudents} students.
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>

      <AlertDialog
        open={!!studentToDelete}
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
    </div>
  );
}
