import { useEffect, useState } from "react";
import type { Task } from "../lib/types";
import { TaskRow } from "../components/TaskRow";
import { TaskDetailPanel } from "../components/TaskDetailPanel";
import { tasks as tasksApi } from "../lib/api";

export function DueSoon() {
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await tasksApi.dueSoon();
      setTaskList(data);
    } catch {
      setError("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async (id: string) => {
    try {
      await tasksApi.toggleComplete(id);
      load();
    } catch {
      setError("Failed to toggle task");
    }
  };

  const overdueCount = taskList.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date()
  ).length;

  return (
    <div className="p-8 max-w-3xl">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded flex justify-between items-center">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Due Soon</h2>
      <p className="text-sm text-gray-500 mb-4">
        Tasks due within the next 7 days
        {overdueCount > 0 && (
          <span className="text-red-600 font-medium"> ({overdueCount} overdue)</span>
        )}
      </p>
      <div className="space-y-2">
        {loading ? (
          <p className="text-center py-8 text-gray-400 text-sm">Loading tasks...</p>
        ) : taskList.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">No upcoming deadlines. Nice!</p>
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
        />
      )}
    </div>
  );
}
