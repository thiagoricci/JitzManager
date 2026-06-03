import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Papa from "papaparse";
import { toast } from "sonner";

interface ImportStudentsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (students: StudentImportData[]) => void;
}

export interface StudentImportData {
  name: string;
  email: string;
  phone: string;
}

export default function ImportStudentsDialog({
  isOpen,
  onClose,
  onImport,
}: ImportStudentsDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<StudentImportData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setFile(file);
      parseFile(file);
    }
  };

  const parseFile = (file: File) => {
    setIsLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setParsedData(results.data as StudentImportData[]);
        setIsLoading(false);
      },
      error: (error) => {
        toast.error(`Error parsing file: ${error.message}`);
        setIsLoading(false);
      },
    });
  };

  const handleImport = () => {
    onImport(parsedData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Import Students</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import students in bulk. The file should
            contain 'name', 'email', and 'phone' columns.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Input type="file" accept=".csv" onChange={handleFileChange} />
          {isLoading ? (
            <div>Loading...</div>
          ) : (
            parsedData.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.email}</TableCell>
                        <TableCell>{row.phone}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={parsedData.length === 0}>
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}