import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Mail, Phone, Calendar, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import BeltBadge, { BeltRank } from "@/components/BeltBadge";

// Mock data (in a real app, this would come from an API/database)
const studentsData: Record<string, any> = {
  "1": { id: 1, name: "Carlos Silva", belt: "blue", email: "carlos@email.com", phone: "+55 11 98765-4321", joinDate: "2024-01-15", birthDate: "1995-03-20" },
  "2": { id: 2, name: "Ana Santos", belt: "white", email: "ana@email.com", phone: "+55 11 98765-4322", joinDate: "2024-01-20", birthDate: "1998-07-15" },
  "3": { id: 3, name: "Pedro Costa", belt: "purple", email: "pedro@email.com", phone: "+55 11 98765-4323", joinDate: "2024-01-22", birthDate: "1992-11-10" },
  "4": { id: 4, name: "Maria Oliveira", belt: "white", email: "maria@email.com", phone: "+55 11 98765-4324", joinDate: "2024-01-25", birthDate: "2000-05-30" },
  "5": { id: 5, name: "João Ferreira", belt: "brown", email: "joao@email.com", phone: "+55 11 98765-4325", joinDate: "2023-06-10", birthDate: "1990-02-14" },
  "6": { id: 6, name: "Beatriz Lima", belt: "blue", email: "beatriz@email.com", phone: "+55 11 98765-4326", joinDate: "2023-08-15", birthDate: "1997-09-22" },
  "7": { id: 7, name: "Rafael Souza", belt: "black", email: "rafael@email.com", phone: "+55 11 98765-4327", joinDate: "2020-01-05", birthDate: "1988-12-01" },
  "8": { id: 8, name: "Julia Martins", belt: "purple", email: "julia@email.com", phone: "+55 11 98765-4328", joinDate: "2023-03-20", birthDate: "1994-04-18" },
};

const attendanceData = [
  { date: "2024-01-29", status: "present" },
  { date: "2024-01-26", status: "present" },
  { date: "2024-01-24", status: "absent" },
  { date: "2024-01-22", status: "present" },
  { date: "2024-01-19", status: "present" },
];

export default function StudentDetail() {
  const { id } = useParams();
  const student = studentsData[id || ""];

  if (!student) {
    return (
      <div className="space-y-6">
        <Link to="/students">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Students
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Student not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/students">
        <Button variant="outline" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Students
        </Button>
      </Link>

      {/* Student Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-primary text-4xl font-bold text-primary-foreground">
              {student.name.charAt(0)}
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-3xl font-bold text-foreground">{student.name}</h2>
                <BeltBadge rank={student.belt as BeltRank} className="w-fit" />
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>{student.email}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{student.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Born {new Date(student.birthDate).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Membership Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Membership Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Join Date</span>
              <span className="font-medium text-foreground">
                {new Date(student.joinDate).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Current Belt</span>
              <BeltBadge rank={student.belt as BeltRank} />
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Time Training</span>
              <span className="font-medium text-foreground">
                {Math.floor((Date.now() - new Date(student.joinDate).getTime()) / (1000 * 60 * 60 * 24 * 30))} months
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium text-accent">Active</span>
            </div>
          </CardContent>
        </Card>

        {/* Recent Attendance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Recent Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {attendanceData.map((record, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <span className="text-sm text-muted-foreground">
                    {new Date(record.date).toLocaleDateString()}
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      record.status === "present" ? "text-accent" : "text-muted-foreground"
                    }`}
                  >
                    {record.status === "present" ? "Present" : "Absent"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
