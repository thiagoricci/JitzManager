import { useQuery } from "@tanstack/react-query";
import { History, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/date";

type AuditEntry = {
  id: number;
  actor_email: string | null;
  action: string;
  entity_type: string;
  summary: string | null;
  created_at: string;
};

// Group actions by the kind of change so the badge colour communicates intent.
function actionVariant(action: string): "default" | "secondary" | "destructive" | "outline" {
  if (action.startsWith("student.rank")) return "default";
  if (action.endsWith(".deleted") || action.startsWith("payment.refund")) return "destructive";
  if (action.startsWith("payment")) return "secondary";
  return "outline";
}

// 'student.rank_changed' -> 'Rank changed'
function actionLabel(action: string): string {
  const verb = action.includes(".") ? action.split(".").slice(1).join(".") : action;
  const words = verb.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export default function AuditLogCard() {
  const { organization } = useAuth();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["audit-log", organization?.id],
    enabled: !!organization?.id,
    queryFn: async (): Promise<AuditEntry[]> => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, actor_email, action, entity_type, summary, created_at")
        .eq("organization_id", organization!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Activity Log
        </CardTitle>
        <CardDescription>
          Recent changes to students, payments, and staff in your gym. The 50 most
          recent entries are shown.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No activity recorded yet.
          </p>
        ) : (
          <ul className="divide-y">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={actionVariant(entry.action)}>{actionLabel(entry.action)}</Badge>
                    <span className="text-xs capitalize text-muted-foreground">
                      {entry.entity_type}
                    </span>
                  </div>
                  <p className="break-words text-sm">{entry.summary ?? entry.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.actor_email ?? "System"}
                  </p>
                </div>
                <time
                  className="shrink-0 whitespace-nowrap text-xs text-muted-foreground"
                  dateTime={entry.created_at}
                >
                  {formatDate(entry.created_at, organization?.timezone, "PP p")}
                </time>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
