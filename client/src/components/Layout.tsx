import { type ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";

interface LayoutProps {
  children: ReactNode;
  activeProjectId: string | null;
  activeView: string;
  activeTagId?: string | null;
  onSelectProject: (id: string) => void;
  onSelectView: (view: "dashboard" | "all-tasks" | "due-soon" | "tags") => void;
  onSelectTag: (tagId: string) => void;
  chatOpen?: boolean;
  refreshKey?: number;
}

export function Layout({ children, activeProjectId, activeView, activeTagId, onSelectProject, onSelectView, onSelectTag, chatOpen, refreshKey }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSelectProject = (id: string) => {
    onSelectProject(id);
    setSidebarOpen(false);
  };

  const handleSelectView = (view: "dashboard" | "all-tasks" | "due-soon" | "tags") => {
    onSelectView(view);
    setSidebarOpen(false);
  };

  const handleSelectTag = (tagId: string) => {
    onSelectTag(tagId);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile hamburger */}
      <button
        onClick={() => setSidebarOpen(true)}
        aria-label="Open menu"
        className="fixed top-3 left-3 z-40 p-2 bg-white border border-gray-200 rounded-lg shadow-sm md:hidden"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar: always visible on md+, slide-in on mobile */}
      <div className={`
        fixed inset-y-0 left-0 z-50 transform transition-transform duration-200
        md:relative md:translate-x-0 md:z-auto
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <Sidebar
          activeProjectId={activeProjectId}
          activeView={activeView}
          activeTagId={activeTagId}
          onSelectProject={handleSelectProject}
          onSelectView={handleSelectView}
          onSelectTag={handleSelectTag}
          refreshKey={refreshKey}
        />
      </div>

      <main
        className="flex-1 overflow-y-auto transition-[margin] duration-300"
        style={{ marginRight: chatOpen ? 480 : 0 }}
      >
        {children}
      </main>
    </div>
  );
}
