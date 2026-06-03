import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MembershipPlan } from "@/types/membership";
import { isFreePrice, isTrialPeriod, toAmount } from "@/lib/money";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  price: z.coerce
    .number({ invalid_type_error: "Price is required" })
    .min(0, "Price can't be negative"),
  period: z.enum([
    "daily",
    "weekly",
    "monthly",
    "quarterly",
    "biannual",
    "annual",
  ]),
  currency: z.string().min(3).max(3),
  setup_fee: z.coerce
    .number({ invalid_type_error: "Setup fee must be a number" })
    .min(0, "Setup fee can't be negative"),
  billing_day_of_month: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z
      .number()
      .int()
      .min(1, "Day must be 1–31")
      .max(31, "Day must be 1–31")
      .nullable()
  ),
  status: z.enum(["active", "inactive"]),
  features: z.array(z.object({ value: z.string() })).optional(),
});

const CURRENCIES = ["USD", "BRL", "EUR", "GBP"] as const;

export type MembershipFormValues = z.infer<typeof formSchema>;

interface MembershipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: MembershipPlan | null;
  onSubmit: (data: MembershipFormValues) => void;
  isSubmitting?: boolean;
}

export function MembershipDialog({
  open,
  onOpenChange,
  initialData,
  onSubmit,
  isSubmitting = false,
}: MembershipDialogProps) {
  const [isTrial, setIsTrial] = useState(false);

  const form = useForm<MembershipFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      period: "monthly",
      currency: "USD",
      setup_fee: 0,
      billing_day_of_month: null,
      status: "active",
      features: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "features",
  });

  useEffect(() => {
    if (open) {
      if (initialData) {
        const isTrialPlan =
          isFreePrice(initialData.price) && isTrialPeriod(initialData.period);
        setIsTrial(isTrialPlan);
        form.reset({
          name: initialData.name,
          description: initialData.description || "",
          price: toAmount(initialData.price),
          period: initialData.period,
          currency: initialData.currency || "USD",
          setup_fee: toAmount(initialData.setup_fee),
          billing_day_of_month: initialData.billing_day_of_month ?? null,
          status: initialData.status as MembershipFormValues["status"],
          features: initialData.features
            ? initialData.features.map((f: string) => ({ value: f }))
            : [],
        });
      } else {
        setIsTrial(false);
        form.reset({
          name: "",
          description: "",
          price: 0,
          period: "monthly",
          currency: "USD",
          setup_fee: 0,
          billing_day_of_month: null,
          status: "active",
          features: [],
        });
      }
    }
  }, [open, initialData, form]);

  const handleTrialChange = (checked: boolean) => {
    setIsTrial(checked);
    if (checked) {
      form.setValue("price", 0);
      form.setValue("period", "weekly");
    } else {
      form.setValue("price", 0);
      form.setValue("period", "monthly");
    }
  };

  const handleSubmit = (values: MembershipFormValues) => {
    onSubmit(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Membership Plan" : "Add Membership Plan"}
          </DialogTitle>
          <DialogDescription>
            {initialData
              ? "Update the details of the membership plan."
              : "Create a new membership plan for your students."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Full Access" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of the plan"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center space-x-2">
              <Switch
                id="trial-mode"
                checked={isTrial}
                onCheckedChange={handleTrialChange}
              />
              <Label htmlFor="trial-mode">Trial Plan (Free)</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="e.g. 150.00"
                        {...field}
                        disabled={isTrial}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="period"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Period</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isTrial ? (
                          <>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="biannual">Biannual</SelectItem>
                            <SelectItem value="annual">Annual</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CURRENCIES.map((code) => (
                          <SelectItem key={code} value={code}>
                            {code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="setup_fee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Setup Fee</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="e.g. 0.00"
                        {...field}
                        disabled={isTrial}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="billing_day_of_month"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Billing Day of Month (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      placeholder="e.g. 1"
                      {...field}
                      value={field.value ?? ""}
                      disabled={isTrial}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>Features</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ value: "" })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Feature
                </Button>
              </div>
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                  <FormField
                    control={form.control}
                    name={`features.${index}.value`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input placeholder="Feature description" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Plan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}