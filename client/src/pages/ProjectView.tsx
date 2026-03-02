import { useEffect, useState } from "react";
import { projects as projectsApi, tasks as tasksApi } from "../lib/api";
import type { Project, Task } from "../lib/types";
import { TaskRow } from "../components/TaskRow";
import { CreateTaskForm } from "../components/CreateTaskForm";

interface ProjectViewProps {
  projectId: string;
}

export function ProjectView({ projectId }: ProjectViewProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [taskList, setTaskList] = useState<Task[]>([]);

  const load = async () => {
    const p = await projectsApi.get(projectId);
    setProject(p);
    setTaskList(p.tasks || []);
  };

  useEffect(() => { load(); }, [projectId]);

  const handleToggleComplete = async (taskId: string) => {
    await tasksApi.toggleComplete(taskId);
    load();
  };

  const handleCreateTask = async (data: { title: string }) => {
    await tasksApi.create(projectId, data);
    load();
  };

  if (!project) return <div className="p-8 text-gray-400">Loading...</div>;

  const completedCount = taskList.filter((t) => t.completed).length;

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          {project.color && (
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
          )}
          <h2 className="text-2xl font-bold text-gray-900">{project.name}</h2>
        </div>
        {project.description && <p className="text-sm text-gray-500">{project.description}</p>}
        <p className="text-xs text-gray-400 mt-1">
          {completedCount}/{taskList.length} tasks completed
        </p>
      </div>

      <div className="mb-4">
        <CreateTaskForm onCreate={handleCreateTask} />
      </div>

      <div className="space-y-2">
        {taskList.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">No tasks yet. Add one above.</p>
        ) : (
          taskList.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggleComplete={handleToggleComplete}
              onSelect={() => {}}
            />
          ))
        )}
      </div>
    </div>
  );
}
