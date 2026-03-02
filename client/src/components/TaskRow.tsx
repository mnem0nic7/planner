import type { Task } from "../lib/types";

interface TaskRowProps {
  task: Task;
  onToggleComplete: (id: string) => void;
  onSelect: (task: Task) => void;
}

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  URGENT: "bg-red-100 text-red-700",
};

export function TaskRow({ task, onToggleComplete, onSelect }: TaskRowProps) {
  const isOverdue = task.dueDate && !task.completed && new Date(task.dueDate) < new Date();

  return (
    <div
      className={`flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors ${
        task.completed ? "opacity-60" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={task.completed}
        onChange={() => onToggleComplete(task.id)}
        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <button
        onClick={() => onSelect(task)}
        className="flex-1 text-left min-w-0"
      >
        <span className={`text-sm ${task.completed ? "line-through text-gray-400" : "text-gray-900"}`}>
          {task.title}
        </span>
      </button>
      <div className="flex items-center gap-2 flex-shrink-0">
        {task.tags.map(({ tag }) => (
          <span
            key={tag.id}
            className="px-1.5 py-0.5 rounded text-xs"
            style={{
              backgroundColor: tag.color ? `${tag.color}20` : "#e5e7eb",
              color: tag.color || "#374151",
            }}
          >
            {tag.name}
          </span>
        ))}
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_STYLES[task.priority]}`}>
          {task.priority}
        </span>
        {task.dueDate && (
          <span className={`text-xs ${isOverdue ? "text-red-600 font-medium" : "text-gray-400"}`}>
            {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}
