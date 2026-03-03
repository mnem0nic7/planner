import { useState, useEffect } from "react";
import { tags as tagsApi } from "../lib/api";
import type { Tag } from "../lib/types";

const DEFAULT_COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

interface TagsPageProps {
  onDataChange?: () => void;
}

export function TagsPage({ onDataChange }: TagsPageProps) {
  const [tagList, setTagList] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_COLORS[0]);
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await tagsApi.list();
      setTagList(data);
    } catch {
      setError("Failed to load tags");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await tagsApi.create({ name: newName.trim(), color: newColor });
      setNewName("");
      setNewColor(DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)]);
      load();
      onDataChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create tag");
    } finally {
      setCreating(false);
    }
  };

  const handleStartEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color || DEFAULT_COLORS[0]);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setError(null);
    try {
      await tagsApi.update(editingId, { name: editName.trim(), color: editColor });
      setEditingId(null);
      load();
      onDataChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update tag");
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await tagsApi.delete(id);
      setDeletingId(null);
      load();
      onDataChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete tag");
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded flex justify-between items-center">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Tags</h2>
      </div>

      {/* Create form */}
      <div className="mb-6 flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg">
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border-0"
          title="Tag color"
        />
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="New tag name..."
          maxLength={100}
          className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleCreate}
          disabled={!newName.trim() || creating}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>

      {/* Tag list */}
      <div className="space-y-2">
        {loading ? (
          <p className="text-center py-8 text-gray-400 text-sm">Loading tags...</p>
        ) : tagList.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">No tags yet. Create one above.</p>
        ) : (
          tagList.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg"
            >
              {editingId === tag.id ? (
                <>
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-0"
                    title="Tag color"
                  />
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    maxLength={100}
                    className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveEdit}
                    className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1 text-gray-500 text-xs font-medium rounded hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </>
              ) : deletingId === tag.id ? (
                <>
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color || "#9ca3af" }}
                  />
                  <span className="flex-1 text-sm text-red-700">
                    Delete &ldquo;{tag.name}&rdquo;?{" "}
                    {tag._count?.tasks ? `${tag._count.tasks} task${tag._count.tasks === 1 ? "" : "s"} will be untagged.` : ""}
                  </span>
                  <button
                    onClick={() => handleDelete(tag.id)}
                    className="px-3 py-1 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setDeletingId(null)}
                    className="px-3 py-1 text-gray-500 text-xs font-medium rounded hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color || "#9ca3af" }}
                  />
                  <span className="flex-1 text-sm text-gray-900">{tag.name}</span>
                  <span className="text-xs text-gray-400">
                    {tag._count?.tasks ?? 0} task{(tag._count?.tasks ?? 0) === 1 ? "" : "s"}
                  </span>
                  <button
                    onClick={() => handleStartEdit(tag)}
                    className="px-3 py-1 text-gray-500 text-xs font-medium rounded hover:bg-gray-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeletingId(tag.id)}
                    className="px-3 py-1 text-red-500 text-xs font-medium rounded hover:bg-red-50"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
