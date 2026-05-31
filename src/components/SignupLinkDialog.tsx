import { useState } from "react";
import { Check, Copy, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface SignupLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName?: string;
  url: string | null;
  isLoading: boolean;
}

export function SignupLinkDialog({
  open,
  onOpenChange,
  planName,
  url,
  isLoading,
}: SignupLinkDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Select and copy the link manually.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Sign-up link{planName ? ` — ${planName}` : ""}</DialogTitle>
          <DialogDescription>
            Share this link with prospective students. When they pay, they're added to your
            Students list automatically.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !url ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Generating link...
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input readOnly value={url} className="bg-muted" onFocus={(e) => e.target.select()} />
              <Button type="button" size="icon" variant="outline" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button type="button" className="flex-1" onClick={handleCopy}>
                {copied ? "Copied!" : "Copy link"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Preview
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
