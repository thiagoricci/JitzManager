import { useParams } from "react-router-dom";
import WaiverSignForm from "@/components/WaiverSignForm";
import { Card, CardContent } from "@/components/ui/card";

export default function Waiver() {
  const { token } = useParams();

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 px-4 py-10">
      <Card className="w-full max-w-2xl">
        <CardContent className="pt-6">
          <WaiverSignForm token={token || ""} />
        </CardContent>
      </Card>
    </div>
  );
}
