import type { Project } from "../lib/types";

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const taskCount = project._count?.tasks ?? 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-2 mb-2">
        {project.color && (
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
        )}
        <h3 className="font-semibold text-gray-900">{project.name}</h3>
      </div>
      {project.description && (
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">{project.description}</p>
      )}
      <div className="text-xs text-gray-400">
        {taskCount} {taskCount === 1 ? "task" : "tasks"}
      </div>
    </button>
  );
}
