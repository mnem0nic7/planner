import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

interface LayoutProps {
  children: ReactNode;
  activeProjectId: string | null;
  activeView: "dashboard" | "project" | "all-tasks" | "due-soon";
  onSelectProject: (id: string) => void;
  onSelectView: (view: "dashboard" | "all-tasks" | "due-soon") => void;
  chatOpen?: boolean;
}

export function Layout({ children, activeProjectId, activeView, onSelectProject, onSelectView, chatOpen }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        activeProjectId={activeProjectId}
        activeView={activeView}
        onSelectProject={onSelectProject}
        onSelectView={onSelectView}
      />
      <main
        className="flex-1 overflow-y-auto transition-[margin] duration-300"
        style={{ marginRight: chatOpen ? 480 : 0 }}
      >
        {children}
      </main>
    </div>
  );
}
