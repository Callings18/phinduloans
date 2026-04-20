import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileEdit, X } from "lucide-react";
import { format } from "date-fns";

interface Props {
  lastSaved: Date | null;
  onResume: () => void;
  onDiscard: () => void;
}

export default function ResumeApplicationBanner({ lastSaved, onResume, onDiscard }: Props) {
  return (
    <Card className="border-info/40 bg-info/5 shadow-card">
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-info/15 border border-info/30 flex items-center justify-center text-info shrink-0">
            <FileEdit size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Continue your loan application</p>
            <p className="text-xs text-muted-foreground truncate">
              You have an unfinished application
              {lastSaved ? ` — last saved ${format(lastSaved, "MMM d, HH:mm")}` : ""}.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onDiscard} title="Discard draft">
            <X size={14} />
          </Button>
          <Button size="sm" className="gradient-primary text-primary-foreground hover:opacity-90 h-8 px-3 text-xs" onClick={onResume}>
            Resume
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
