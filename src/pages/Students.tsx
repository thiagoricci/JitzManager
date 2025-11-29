import { useState } from "react";
import { Search, Mail, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import BeltBadge, { BeltRank } from "@/components/BeltBadge";
import { Link } from "react-router-dom";

// Mock data
const studentsData = [
  { id: 1, name: "Carlos Silva", belt: "blue" as BeltRank, email: "carlos@email.com", phone: "+55 11 98765-4321", joinDate: "2024-01-15" },
  { id: 2, name: "Ana Santos", belt: "white" as BeltRank, email: "ana@email.com", phone: "+55 11 98765-4322", joinDate: "2024-01-20" },
  { id: 3, name: "Pedro Costa", belt: "purple" as BeltRank, email: "pedro@email.com", phone: "+55 11 98765-4323", joinDate: "2024-01-22" },
  { id: 4, name: "Maria Oliveira", belt: "white" as BeltRank, email: "maria@email.com", phone: "+55 11 98765-4324", joinDate: "2024-01-25" },
  { id: 5, name: "João Ferreira", belt: "brown" as BeltRank, email: "joao@email.com", phone: "+55 11 98765-4325", joinDate: "2023-06-10" },
  { id: 6, name: "Beatriz Lima", belt: "blue" as BeltRank, email: "beatriz@email.com", phone: "+55 11 98765-4326", joinDate: "2023-08-15" },
  { id: 7, name: "Rafael Souza", belt: "black" as BeltRank, email: "rafael@email.com", phone: "+55 11 98765-4327", joinDate: "2020-01-05" },
  { id: 8, name: "Julia Martins", belt: "purple" as BeltRank, email: "julia@email.com", phone: "+55 11 98765-4328", joinDate: "2023-03-20" },
];

export default function Students() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredStudents = studentsData.filter((student) =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Students</h2>
          <p className="text-muted-foreground">Manage your academy students</p>
        </div>
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredStudents.map((student) => (
          <Link key={student.id} to={`/student/${student.id}`}>
            <Card className="h-full transition-all hover:shadow-lg hover:border-primary/50">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-primary text-xl font-bold text-primary-foreground">
                    {student.name.charAt(0)}
                  </div>
                  <BeltBadge rank={student.belt} />
                </div>
                
                <h3 className="text-lg font-bold text-foreground mb-3">{student.name}</h3>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{student.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{student.phone}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Member since {new Date(student.joinDate).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
