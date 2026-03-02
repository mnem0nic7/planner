import { useEffect, useState } from "react";
import { projects as projectsApi } from "../lib/api";
import type { Project } from "../lib/types";
import { ProjectCard } from "../components/ProjectCard";
import { CreateProjectDialog } from "../components/CreateProjectDialog";

interface DashboardProps {
  onSelectProject: (id: string) => void;
}

export function Dashboard({ onSelectProject }: DashboardProps) {
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  const loadProjects = () => {
    projectsApi.list().then(setProjectList);
  };

  useEffect(() => { loadProjects(); }, []);

  const handleCreate = async (data: { name: string; description?: string; color?: string }) => {
    await projectsApi.create(data);
    loadProjects();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          + New Project
        </button>
      </div>

      {projectList.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-2">No projects yet</p>
          <p className="text-sm">Create your first project to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projectList.map((project) => (
            <ProjectCard key={project.id} project={project} onClick={() => onSelectProject(project.id)} />
          ))}
        </div>
      )}

      <CreateProjectDialog open={showCreate} onClose={() => setShowCreate(false)} onCreate={handleCreate} />
    </div>
  );
}
