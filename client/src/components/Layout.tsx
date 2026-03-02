import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

interface LayoutProps {
  children: ReactNode;
  activeProjectId: string | null;
  activeView: "dashboard" | "project" | "all-tasks" | "due-soon";
  onSelectProject: (id: string) => void;
  onSelectView: (view: "dashboard" | "all-tasks" | "due-soon") => void;
}

export function Layout({ children, activeProjectId, activeView, onSelectProject, onSelectView }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        activeProjectId={activeProjectId}
        activeView={activeView}
        onSelectProject={onSelectProject}
        onSelectView={onSelectView}
      />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
