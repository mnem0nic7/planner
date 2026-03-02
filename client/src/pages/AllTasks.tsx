import { useEffect, useState } from "react";
import type { Task } from "../lib/types";
import { TaskRow } from "../components/TaskRow";
import { TaskDetailPanel } from "../components/TaskDetailPanel";
import { tasks as tasksApi } from "../lib/api";

export function AllTasks() {
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const load = async () => {
    const data = await tasksApi.listAll();
    setTaskList(data);
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async (id: string) => {
    await tasksApi.toggleComplete(id);
    load();
  };

  return (
    <div className="p-8 max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">All Tasks</h2>
      <div className="space-y-2">
        {taskList.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">No tasks yet.</p>
        ) : (
          taskList.map((task) => (
            <TaskRow key={task.id} task={task} onToggleComplete={handleToggle} onSelect={setSelectedTask} />
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
