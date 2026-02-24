import { Badge } from "@/components/ui/badge";
import { Flame } from "lucide-react";

export function SimmrBadge() {
  return (
    <Badge variant="secondary" className="gap-1 text-xs">
      <Flame className="h-3 w-3 text-primary" />
      Simmr
    </Badge>
  );
}
