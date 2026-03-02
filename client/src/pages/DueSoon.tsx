import { useEffect, useState } from "react";
import type { Task } from "../lib/types";
import { TaskRow } from "../components/TaskRow";
import { tasks as tasksApi } from "../lib/api";

export function DueSoon() {
  const [taskList, setTaskList] = useState<Task[]>([]);

  const load = async () => {
    const res = await fetch("/api/tasks/due-soon");
    setTaskList(await res.json());
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async (id: string) => {
    await tasksApi.toggleComplete(id);
    load();
  };

  return (
    <div className="p-8 max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Due Soon</h2>
      <p className="text-sm text-gray-500 mb-4">Tasks due within the next 7 days</p>
      <div className="space-y-2">
        {taskList.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">No upcoming deadlines. Nice!</p>
        ) : (
          taskList.map((task) => (
            <TaskRow key={task.id} task={task} onToggleComplete={handleToggle} onSelect={() => {}} />
          ))
        )}
      </div>
    </div>
  );
}
