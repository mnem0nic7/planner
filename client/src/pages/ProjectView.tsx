import { useEffect, useState } from "react";
import { projects as projectsApi, tasks as tasksApi } from "../lib/api";
import type { Project, Task } from "../lib/types";
import { TaskRow } from "../components/TaskRow";
import { CreateTaskForm } from "../components/CreateTaskForm";
import { TaskDetailPanel } from "../components/TaskDetailPanel";

interface ProjectViewProps {
  projectId: string;
}

export function ProjectView({ projectId }: ProjectViewProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const p = await projectsApi.get(projectId);
      setProject(p);
      setTaskList(p.tasks || []);
      // Update selectedTask with fresh data from the reload
      setSelectedTask((prev) => prev ? (p.tasks || []).find((t: Task) => t.id === prev.id) || null : null);
    } catch {
      setError("Failed to load project");
    }
  };

  useEffect(() => { load(); }, [projectId]);

  const handleToggleComplete = async (taskId: string) => {
    try {
      await tasksApi.toggleComplete(taskId);
      load();
    } catch {
      setError("Failed to toggle task");
    }
  };

  const handleCreateTask = async (data: { title: string }) => {
    try {
      await tasksApi.create(projectId, data);
      load();
    } catch {
      setError("Failed to create task");
    }
  };

  if (error && !project) return (
    <div className="p-8">
      <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">{error}</div>
    </div>
  );
  if (!project) return <p className="text-center py-16 text-gray-400 text-sm">Loading project...</p>;

  const completedCount = taskList.filter((t) => t.completed).length;

  return (
    <div className="p-8 max-w-3xl">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded flex justify-between items-center">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600" aria-label="Dismiss error">&times;</button>
        </div>
      )}
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
              onSelect={(task) => setSelectedTask(task)}
            />
          ))
        )}
      </div>

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={() => { load(); setSelectedTask(null); }}
          onRefresh={load}
        />
      )}
    </div>
  );
}
