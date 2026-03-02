import { useEffect, useState } from "react";
import { projects as projectsApi, tags as tagsApi } from "../lib/api";
import type { Project, Tag } from "../lib/types";

interface SidebarProps {
  activeProjectId: string | null;
  activeView: "dashboard" | "project" | "all-tasks" | "due-soon";
  onSelectProject: (id: string) => void;
  onSelectView: (view: "dashboard" | "all-tasks" | "due-soon") => void;
  refreshKey?: number;
}

export function Sidebar({ activeProjectId, activeView, onSelectProject, onSelectView, refreshKey }: SidebarProps) {
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [tagList, setTagList] = useState<Tag[]>([]);

  useEffect(() => {
    projectsApi.list().then(setProjectList);
    tagsApi.list().then(setTagList);
  }, [refreshKey]);

  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Planner</h1>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        <button
          onClick={() => onSelectView("dashboard")}
          className={`w-full text-left px-3 py-2 rounded text-sm font-medium ${
            activeView === "dashboard" ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => onSelectView("all-tasks")}
          className={`w-full text-left px-3 py-2 rounded text-sm font-medium ${
            activeView === "all-tasks" ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          All Tasks
        </button>
        <button
          onClick={() => onSelectView("due-soon")}
          className={`w-full text-left px-3 py-2 rounded text-sm font-medium ${
            activeView === "due-soon" ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          Due Soon
        </button>

        <div className="pt-4">
          <h2 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Projects</h2>
          <div className="mt-2 space-y-1">
            {projectList.map((project) => (
              <button
                key={project.id}
                onClick={() => onSelectProject(project.id)}
                className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 ${
                  activeProjectId === project.id ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {project.color && (
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                )}
                {project.name}
              </button>
            ))}
          </div>
        </div>

        {tagList.length > 0 && (
          <div className="pt-4">
            <h2 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tags</h2>
            <div className="mt-2 flex flex-wrap gap-1 px-3">
              {tagList.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                  style={{
                    backgroundColor: tag.color ? `${tag.color}20` : "#e5e7eb",
                    color: tag.color || "#374151",
                  }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}
