import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UndoProvider } from "@/lib/undo";
import "@/styles.css";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <TooltipProvider>
      <UndoProvider>
        <Outlet />
        <Toaster />
      </UndoProvider>
    </TooltipProvider>
  );
}
