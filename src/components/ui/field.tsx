import { cloneElement, isValidElement, useId, type ReactNode } from "react";
import { Label } from "@/components/ui/label";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const generatedId = useId();
  const child = isValidElement<{ id?: string }>(children) ? children : undefined;
  const id = child?.props.id ?? generatedId;
  return (
    <div className="grid gap-2">
      <Label htmlFor={child ? id : undefined} className="text-muted-foreground font-normal">{label}</Label>
      {child ? cloneElement(child, { id }) : children}
    </div>
  );
}
