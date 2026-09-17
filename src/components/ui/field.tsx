import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label className="text-muted-foreground font-normal">{label}</Label>
      {children}
    </div>
  );
}
