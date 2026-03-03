import { useState, useEffect, useRef } from "react";
import { tasks as tasksApi, tags as tagsApi } from "../lib/api";
import { useFocusTrap } from "../lib/useFocusTrap";
import type { Task, Tag, Priority } from "../lib/types";

interface TaskDetailPanelProps {
  task: Task;
  onClose: () => void;
  onUpdate: () => void;
  onRefresh?: () => void;
}

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export function TaskDetailPanel({ task, onClose, onUpdate, onRefresh }: TaskDetailPanelProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate?.split("T")[0] || "");
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [activeTagIds, setActiveTagIds] = useState<Set<string>>(
    new Set(task.tags.map((t) => t.tagId))
  );
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const trapRef = useFocusTrap<HTMLDivElement>();
  // Ref tracks latest form values so async saves always read current data
  const fieldsRef = useRef({ title, description, priority, dueDate });
  fieldsRef.current = { title, description, priority, dueDate };

  useEffect(() => {
    tagsApi.list().then(setAllTags).catch(() => { /* tags load is non-critical */ });
  }, []);

  // Sync all local state when task prop changes (e.g., parent refreshes after AI mutation)
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || "");
    setPriority(task.priority);
    setDueDate(task.dueDate?.split("T")[0] || "");
    setActiveTagIds(new Set(task.tags.map((t) => t.tagId)));
  }, [task]);

  // Save on blur — reads from ref to avoid stale closure state
  const handleSave = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    const { title: t, description: d, priority: p, dueDate: dd } = fieldsRef.current;
    try {
      await tasksApi.update(task.id, {
        title: t,
        description: d || undefined,
        priority: p,
        // Send null to clear due date; undefined means "don't change"
        dueDate: dd === "" ? null : (dd || undefined),
      });
      onUpdate();
    } catch {
      setError("Failed to save changes");
    } finally {
      savingRef.current = false;
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this task?")) return;
    try {
      await tasksApi.delete(task.id);
      onUpdate();
      onClose();
    } catch {
      setError("Failed to delete task");
    }
  };

  const handleToggleTag = async (tag: Tag) => {
    const hasTag = activeTagIds.has(tag.id);
    // Optimistic update
    setActiveTagIds((prev) => {
      const next = new Set(prev);
      if (hasTag) next.delete(tag.id);
      else next.add(tag.id);
      return next;
    });
    try {
      if (hasTag) {
        await tasksApi.removeTag(task.id, tag.id);
      } else {
        await tasksApi.addTag(task.id, tag.id);
      }
      // Refresh parent data without closing the panel
      (onRefresh || onUpdate)();
    } catch {
      // Revert optimistic update
      setActiveTagIds((prev) => {
        const next = new Set(prev);
        if (hasTag) next.add(tag.id);
        else next.delete(tag.id);
        return next;
      });
      setError("Failed to update tag");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex justify-end z-50"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Task details"
    >
      <div ref={trapRef} className="w-full max-w-md bg-white h-full overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Task Details</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl" aria-label="Close task details">&times;</button>
        </div>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded flex justify-between items-center">
            {error}
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600" aria-label="Dismiss error">&times;</button>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="task-title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleSave}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="task-priority" className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              id="task-priority"
              value={priority}
              onChange={(e) => {
                const newPriority = e.target.value as Priority;
                setPriority(newPriority);
                // Update ref immediately so handleSave reads correct value
                fieldsRef.current = { ...fieldsRef.current, priority: newPriority };
                handleSave();
              }}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="task-due-date" className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
            <input
              id="task-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              onBlur={handleSave}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="task-notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              id="task-notes"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleSave}
              rows={6}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add notes..."
            />
          </div>

          {allTags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => {
                  const active = activeTagIds.has(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => handleToggleTag(tag)}
                      className={`px-2 py-1 rounded text-xs font-medium border ${
                        active ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white"
                      }`}
                      style={active && tag.color ? { borderColor: tag.color, backgroundColor: `${tag.color}20` } : {}}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-4 border-t">
            <button onClick={handleDelete} className="text-sm text-red-600 hover:text-red-800">
              Delete task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
