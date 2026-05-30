import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, DollarSign, Calendar, Shield, Check, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

interface MembershipPlan {
  id: number;
  name: string;
  price: string;
  period: string;
  description?: string;
  features?: string[];
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

interface ActivateStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plans: MembershipPlan[];
  selectedPlanId: string;
  onSelectPlan: (planId: string) => void;
  onProceedToPayment: (paymentMethodId?: string, billingStartDate?: string) => void;
  onActivateFreePlan: () => void;
  isProcessing: boolean;
  studentName: string;
  studentStatus?: "trial" | "student";
  paymentMethods?: PaymentMethod[];
}

function todayString() {
  return new Date().toISOString().split("T")[0];
}

export default function ActivateStudentDialog({
  open,
  onOpenChange,
  plans,
  selectedPlanId,
  onSelectPlan,
  onProceedToPayment,
  onActivateFreePlan,
  isProcessing,
  studentName,
  studentStatus,
  paymentMethods = [],
}: ActivateStudentDialogProps) {
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>("new");
  const [billingStartDate, setBillingStartDate] = useState<string>(todayString());

  useEffect(() => {
    if (open) {
      setBillingStartDate(todayString());
      if (paymentMethods && paymentMethods.length > 0) {
        setSelectedPaymentMethodId(paymentMethods[0].id);
      } else {
        setSelectedPaymentMethodId("new");
      }
    }
  }, [open, paymentMethods]);

  const filteredPlans =
    studentStatus === "student"
      ? plans.filter((plan) => {
          const isTrialPlan =
            (plan.price === "0" || plan.price === "0.00") &&
            ["Daily", "Weekly"].includes(plan.period);
          return !isTrialPlan;
        })
      : plans;

  const selectedPlan = filteredPlans.find((p) => p.id.toString() === selectedPlanId);
  const isFreePlan = selectedPlan?.price === "0" || selectedPlan?.price === "0.00";
  const isFutureStart = billingStartDate > todayString();

  const handleAction = () => {
    if (isFreePlan) {
      onActivateFreePlan();
    } else {
      onProceedToPayment(
        selectedPaymentMethodId === "new" ? undefined : selectedPaymentMethodId,
        billingStartDate !== todayString() ? billingStartDate : undefined
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Activate Student Membership</DialogTitle>
          <DialogDescription>
            Select a membership plan for{" "}
            <span className="font-semibold text-foreground">{studentName}</span>
            {isFreePlan
              ? " and activate their membership."
              : " and proceed to secure payment to activate their membership."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Plan Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Select Membership Plan</label>
            <Select value={selectedPlanId} onValueChange={onSelectPlan}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a plan" />
              </SelectTrigger>
              <SelectContent>
                {filteredPlans?.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id.toString()}>
                    <div className="flex items-center justify-between gap-4 w-full">
                      <span>{plan.name}</span>
                      <span className="text-muted-foreground">
                        {plan.price === "0" || plan.price === "0.00"
                          ? "Free"
                          : `$${plan.price}/${plan.period}`}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Plan Details */}
          {selectedPlan && (
            <Card className="border-primary/20 bg-accent/5">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{selectedPlan.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{selectedPlan.description}</p>
                  </div>
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    <Calendar className="h-3 w-3 mr-1" />
                    {selectedPlan.period}
                  </Badge>
                </div>

                {selectedPlan.features && selectedPlan.features.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Included Features:</p>
                    <ul className="space-y-1.5">
                      {selectedPlan.features.map((feature, index) => (
                        <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-0.5">✓</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {isFutureStart ? "Amount Due on Start Date:" : "Amount Due Today:"}
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-foreground">
                      {isFreePlan ? "Free" : `$${selectedPlan.price}`}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Billing Start Date — only for paid plans */}
          {!isFreePlan && selectedPlan && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                Billing Start Date
              </Label>
              <Input
                type="date"
                min={todayString()}
                value={billingStartDate}
                onChange={(e) => setBillingStartDate(e.target.value)}
              />
              {isFutureStart ? (
                <p className="text-xs text-amber-600">
                  First charge will be on{" "}
                  {new Date(billingStartDate + "T12:00:00").toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                  . The student can train immediately.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Billing starts today. Change this if the student needs to wait for their payday.
                </p>
              )}
            </div>
          )}

          {/* Payment Method — only for paid plans */}
          {!isFreePlan && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Payment Method</label>
              {paymentMethods.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {paymentMethods.map((method) => (
                    <div
                      key={method.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                        selectedPaymentMethodId === method.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-accent/50"
                      )}
                      onClick={() => setSelectedPaymentMethodId(method.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-12 bg-background rounded border flex items-center justify-center">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium capitalize">
                            {method.brand} •••• {method.last4}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Expires {method.exp_month}/{method.exp_year}
                          </span>
                        </div>
                      </div>
                      {selectedPaymentMethodId === method.id && (
                        <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                  ))}

                  <div
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedPaymentMethodId === "new"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent/50"
                    )}
                    onClick={() => setSelectedPaymentMethodId("new")}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-12 bg-background rounded border flex items-center justify-center">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-medium">Use a new card</span>
                    </div>
                    {selectedPaymentMethodId === "new" && (
                      <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <Card className="border-muted bg-muted/20">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <Shield className="h-5 w-5 text-primary" />
                      </div>
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-medium text-foreground">No Payment Method on File</p>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          You'll be redirected to our secure payment processor to add a card and complete
                          the transaction.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            onClick={handleAction}
            disabled={!selectedPlanId || isProcessing}
            className={cn("min-w-[200px]", isProcessing && "cursor-wait")}
          >
            {isProcessing ? (
              <>
                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                {isFreePlan
                  ? "Activating..."
                  : selectedPaymentMethodId === "new"
                  ? "Redirecting..."
                  : "Processing..."}
              </>
            ) : isFreePlan ? (
              "Activate Membership"
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                {paymentMethods.length === 0 || selectedPaymentMethodId === "new"
                  ? "Proceed to Secure Payment"
                  : isFutureStart
                  ? "Schedule Membership"
                  : "Charge Saved Card"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
