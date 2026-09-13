import { Toaster } from "sonner";
import { SessionBar } from "@/components/auth/session-bar";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col bg-background">
      <SessionBar />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {children}
      </div>
      <Toaster position="top-center" />
    </div>
  );
}
