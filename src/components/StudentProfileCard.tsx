import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BeltBadge from "@/components/BeltBadge";
import { BarChart, Edit } from "lucide-react";
import { BeltRank } from "@/components/BeltBadge";
import { differenceInMonths, differenceInYears } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Student {
  id: string;
  name: string;
  belt: BeltRank;
  join_date: string;
  stripes: number;
}

interface StudentProfileCardProps {
  student: Student;
  totalClasses: number;
  classesThisWeek: number;
  onUpdate: (updates: { belt: BeltRank; stripes: number }) => Promise<void>;
  // Whether the current user may change the student's rank (belt/stripes).
  canEdit?: boolean;
}

export default function StudentProfileCard({
  student,
  totalClasses,
  classesThisWeek,
  onUpdate,
  canEdit = true,
}: StudentProfileCardProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedBelt, setSelectedBelt] = useState<BeltRank>(student.belt);
  const [selectedStripes, setSelectedStripes] = useState<number>(
    student.stripes
  );
  const trainingDuration = (joinDate: string) => {
    const now = new Date();
    const join = new Date(joinDate);
    const years = differenceInYears(now, join);
    const months = differenceInMonths(now, join) % 12;

    let duration = "";
    if (years > 0) {
      duration += `${years} year${years > 1 ? "s" : ""}`;
    }
    if (months > 0) {
      if (years > 0) duration += ", ";
      duration += `${months} month${months > 1 ? "s" : ""}`;
    }
    return duration || "Just started";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5 text-primary" />
            Progression
          </CardTitle>
          {canEdit && (
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Edit className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Progression</DialogTitle>
                <DialogDescription>
                  Update the student's belt and stripes.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="belt" className="text-right">
                    Belt
                  </Label>
                  <Select
                    value={selectedBelt}
                    onValueChange={(value) =>
                      setSelectedBelt(value as BeltRank)
                    }
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select a belt" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(BeltRank).map((rank) => (
                        <SelectItem key={rank} value={rank}>
                          {rank.charAt(0).toUpperCase() + rank.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="stripes" className="text-right">
                    Stripes
                  </Label>
                  <Input
                    id="stripes"
                    type="number"
                    value={selectedStripes}
                    onChange={(e) =>
                      setSelectedStripes(parseInt(e.target.value, 10))
                    }
                    className="col-span-3"
                    max={4}
                    min={0}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    await onUpdate({
                      belt: selectedBelt,
                      stripes: selectedStripes,
                    });
                    setIsEditDialogOpen(false);
                  }}
                >
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="flex justify-between items-center py-2 border-b border-border">
          <span className="text-muted-foreground">Belt</span>
          <BeltBadge rank={student.belt} />
        </div>
        <div className="py-2 border-b border-border">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Stripes</span>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: 4 }, (_, i) => (
                <span
                  key={i}
                  className={`h-3.5 w-3.5 rounded-full border-2 transition-colors ${
                    i < student.stripes
                      ? "bg-primary border-primary"
                      : "bg-transparent border-muted-foreground/25"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-between py-2 border-b border-border">
          <span className="text-muted-foreground">Training for</span>
          <span className="font-medium text-foreground">
            {trainingDuration(student.join_date)}
          </span>
        </div>
        <div className="flex justify-between py-2 border-b border-border">
          <span className="text-muted-foreground">Total Classes</span>
          <span className="font-medium text-foreground">{totalClasses}</span>
        </div>
        <div className="flex justify-between py-2">
          <span className="text-muted-foreground">Classes this week</span>
          <span className="font-medium text-foreground">{classesThisWeek}</span>
        </div>
      </CardContent>
    </Card>
  );
}