import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Seo } from "@/lib/seo";
import * as z from "zod";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { getTodayInTimezone } from "@/lib/date";
import { Loader2 } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const studentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
  birth_date: z.string().optional(),
});

type StudentFormValues = z.infer<typeof studentSchema>;

export default function AddStudent() {
  const navigate = useNavigate();
  const { profile, organization } = useAuth();

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      birth_date: "",
    },
  });

  const addStudentMutation = useMutation({
    mutationFn: async (newStudent: {
      name: string;
      email: string | null;
      phone: string | null;
      birth_date: string | null;
      status: string;
      belt: string;
      stripes: number;
      join_date: string;
      organization_id: string;
    }) => {
      const { data, error } = await supabase
        .from("students")
        .insert([newStudent])
        .select("id")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Student added successfully!");
      navigate("/students");
    },
    onError: (error) => {
      toast.error(`Error adding student: ${error.message}`);
    },
  });

  const onSubmit = (values: StudentFormValues) => {
    if (!profile?.organization_id) {
      toast.error("Organization not found");
      return;
    }

    const studentData = {
      name: values.name,
      email: values.email || null,
      phone: values.phone || null,
      birth_date: values.birth_date || null,
      status: "none",
      belt: "white",
      stripes: 0,
      join_date: getTodayInTimezone(organization?.timezone),
      organization_id: profile.organization_id,
    };

    addStudentMutation.mutate(studentData);
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          Add New Student
        </h2>
        <p className="text-muted-foreground">
          Register a new student to your academy.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student Information</CardTitle>
          <CardDescription>
            Fill out the form below to add a new student.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter student's full name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="Enter phone number"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="student@email.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="birth_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input type="date" max={new Date().toISOString().split('T')[0]} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate(-1)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={addStudentMutation.isPending}
                >
                  {addStudentMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Add Student
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
