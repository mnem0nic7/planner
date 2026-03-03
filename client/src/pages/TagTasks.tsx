import { useState, useEffect } from "react";
import type { Task, Tag } from "../lib/types";
import { tasks as tasksApi, tags as tagsApi } from "../lib/api";
import { TaskRow } from "../components/TaskRow";
import { TaskDetailPanel } from "../components/TaskDetailPanel";

interface TagTasksProps {
  tagId: string;
  onBack?: () => void;
}

export function TagTasks({ tagId, onBack }: TagTasksProps) {
  const [tag, setTag] = useState<Tag | null>(null);
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [allTags, data] = await Promise.all([
        tagsApi.list(),
        tasksApi.listFiltered({ tagId }),
      ]);
      setTag(allTags.find(t => t.id === tagId) || null);
      setTaskList(data);
    } catch {
      setError("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tagId]);

  const handleToggle = async (id: string) => {
    try {
      await tasksApi.toggleComplete(id);
      load();
    } catch {
      setError("Failed to toggle task");
    }
  };

  return (
    <div className="p-8 max-w-3xl">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded flex justify-between items-center">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600" aria-label="Dismiss error">&times;</button>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
            aria-label="Back to tags"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {tag && (
          <>
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: tag.color || "#9ca3af" }}
            />
            <h2 className="text-2xl font-bold text-gray-900">{tag.name}</h2>
            <span className="text-sm text-gray-400">
              {taskList.length} task{taskList.length === 1 ? "" : "s"}
            </span>
          </>
        )}
      </div>

      <div className="space-y-2">
        {loading ? (
          <p className="text-center py-8 text-gray-400 text-sm">Loading tasks...</p>
        ) : taskList.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">No tasks with this tag.</p>
        ) : (
          taskList.map((task) => (
            <TaskRow key={task.id} task={task} onToggleComplete={handleToggle} onSelect={setSelectedTask} showProject />
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
