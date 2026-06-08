import { useParams } from "react-router-dom";
import { Seo } from "@/lib/seo";
import { Mail, Phone, MoreHorizontal, ArrowUpDown, ArrowLeft } from "lucide-react";
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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/date";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";

export default function MembershipDetail() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { organization } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "join_date",
    direction: "desc",
  });

  const { data: membershipPlan, isLoading: isPlanLoading } = useQuery({
    queryKey: ["membershipPlan", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membership_plans")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: students, isLoading: isStudentsLoading } = useQuery({
    queryKey: ["students", "membership", id, sortConfig],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("membership_plan_id", id)
        .order(sortConfig.key, { ascending: sortConfig.direction === "asc" });

      if (error) throw error;
      return data;
    },
  });

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

  if (isPlanLoading || isStudentsLoading) {
    return <div>Loading...</div>;
  }

  if (!membershipPlan) {
    return <div>Membership plan not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            {membershipPlan.name}
          </h2>
          <p className="text-muted-foreground">
            {membershipPlan.description}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative w-full sm:w-80">
          <Input
            placeholder="Search students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                onClick={() => handleSort("belt")}
              >
                Belt {renderSortArrow("belt")}
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
                  <div className="flex items-center gap-2">
                    <BeltBadge rank={student.belt as BeltRank} />
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
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}