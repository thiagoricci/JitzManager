import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Seo } from "@/lib/seo";
import { toast } from "sonner";

export default function PaymentCancelled() {
  const navigate = useNavigate();

  useEffect(() => {
    toast.error("Payment was cancelled. Please try again.");
    navigate("/students");
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="mt-4 text-2xl font-bold">Payment Cancelled</h1>
      <p className="text-muted-foreground">Redirecting to the students page...</p>
    </div>
  );
}