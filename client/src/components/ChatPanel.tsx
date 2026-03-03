import { useState, useEffect, useRef } from "react";
import { chat } from "../lib/api";
import type { Conversation } from "../lib/types";

interface ToolCallDisplay {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallDisplay[];
}

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  onDataChange: () => void;
  activeProjectId: string | null;
}

function ToolCallCard({ toolCall }: { toolCall: ToolCallDisplay }) {
  const friendlyNames: Record<string, string> = {
    list_projects: "Listed projects",
    get_project: "Fetched project details",
    create_project: "Created project",
    update_project: "Updated project",
    delete_project: "Deleted project",
    list_tasks: "Listed tasks",
    create_task: "Created task",
    update_task: "Updated task",
    complete_task: "Toggled task completion",
    delete_task: "Deleted task",
    list_tags: "Listed tags",
    create_tag: "Created tag",
    update_tag: "Updated tag",
    add_tag_to_task: "Added tag to task",
    remove_tag_from_task: "Removed tag from task",
    get_due_soon: "Checked upcoming tasks",
    get_workload_summary: "Checked workload",
    bulk_complete_tasks: "Bulk completed tasks",
    bulk_delete_tasks: "Bulk deleted tasks",
    bulk_move_tasks: "Bulk moved tasks",
  };

  const label = friendlyNames[toolCall.name] || toolCall.name;
  const isComplete = toolCall.result !== undefined || toolCall.error;

  return (
    <div className="mx-4 mb-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
      <div className="flex items-center gap-2">
        <span className={isComplete ? "text-green-600" : "text-amber-600"}>
          {isComplete ? "\u2713" : "\u231B"}
        </span>
        <span className="font-medium text-gray-700">{label}</span>
      </div>
      {toolCall.error && (
        <p className="text-red-600 text-xs mt-1">Error: {toolCall.error}</p>
      )}
    </div>
  );
}

export function ChatPanel({ open, onClose, onDataChange, activeProjectId }: ChatPanelProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingToolCalls, setStreamingToolCalls] = useState<
    ToolCallDisplay[]
  >([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [error, setError] = useState<string | null>(null);

  const loadConversations = () => {
    chat.conversations().then(setConversations).catch(() => setError("Failed to load conversations"));
  };

  // Load conversations list on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Load conversation history when active conversation changes
  useEffect(() => {
    if (!activeConversationId) return;
    chat.getConversation(activeConversationId).then((conv) => {
      if (!conv.messages) return;
      const displayMsgs: DisplayMessage[] = [];
      for (const msg of conv.messages) {
        if (msg.role === "user") {
          displayMsgs.push({ role: "user", content: msg.content || "" });
        } else if (msg.role === "assistant") {
          displayMsgs.push({ role: "assistant", content: msg.content || "" });
        }
        // Skip "tool" messages -- they are shown inline via toolCalls on assistant messages
      }
      setMessages(displayMsgs);
    }).catch(() => setError("Failed to load conversation"));
  }, [activeConversationId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  function handleNewConversation() {
    setActiveConversationId(null);
    setMessages([]);
    setShowHistory(false);
  }

  function handleSelectConversation(id: string) {
    setActiveConversationId(id);
    setShowHistory(false);
  }

  const [deletingConvId, setDeletingConvId] = useState<string | null>(null);

  async function handleDeleteConversation(id: string) {
    try {
      await chat.deleteConversation(id);
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
      setDeletingConvId(null);
      loadConversations();
    } catch {
      setError("Failed to delete conversation");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function sendMessage() {
    if (!input.trim() || isStreaming) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsStreaming(true);
    setStreamingContent("");
    setStreamingToolCalls([]);

    const currentToolCalls: ToolCallDisplay[] = [];

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversationId,
          message: userMsg,
          ...(activeProjectId && { activeProjectId }),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed: ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";
      // eventType persists across read() boundaries so split event/data pairs work
      let eventType = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7);
          } else if (line.startsWith("data: ")) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let data: any;
            try {
              data = JSON.parse(line.slice(6));
            } catch {
              continue;
            }
            switch (eventType) {
              case "content":
                fullContent += data.delta;
                setStreamingContent(fullContent);
                break;
              case "tool_call":
                currentToolCalls.push({
                  id: data.id,
                  name: data.name,
                  args: data.args,
                });
                setStreamingToolCalls([...currentToolCalls]);
                break;
              case "tool_result": {
                const tc = currentToolCalls.find((t) => t.id === data.id);
                if (tc) {
                  tc.result = data.result;
                  tc.error = data.error;
                  setStreamingToolCalls([...currentToolCalls]);
                }
                break;
              }
              case "done":
                setActiveConversationId(data.conversationId);
                loadConversations();
                break;
              case "error":
                fullContent += `\n\nError: ${data.message}`;
                setStreamingContent(fullContent);
                break;
            }
          }
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: fullContent,
          toolCalls:
            currentToolCalls.length > 0 ? [...currentToolCalls] : undefined,
        },
      ]);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Something went wrong";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${errMsg}` },
      ]);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      setStreamingToolCalls([]);
      onDataChange();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed top-0 right-0 h-full w-full sm:w-[480px] max-w-full bg-white border-l border-gray-200 shadow-lg flex flex-col z-40" role="complementary" aria-label="AI Assistant chat">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">AI Assistant</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory((v) => !v)}
            title="Conversation history"
            aria-label="Conversation history"
            className={`p-1.5 hover:bg-gray-100 rounded ${showHistory ? "text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button
            onClick={handleNewConversation}
            title="New conversation"
            aria-label="New conversation"
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={onClose}
            aria-label="Close chat"
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Conversation history panel */}
      {showHistory && (
        <div className="border-b border-gray-200 max-h-64 overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-4">No past conversations.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {conversations.map((conv) => (
                <div key={conv.id}>
                  {deletingConvId === conv.id ? (
                    <div className="flex items-center justify-between px-4 py-2 bg-red-50">
                      <span className="text-sm text-red-700">Delete this conversation?</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDeleteConversation(conv.id)}
                          className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setDeletingConvId(null)}
                          className="px-2 py-1 text-gray-500 text-xs rounded hover:bg-gray-100"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={`w-full flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-50 text-left ${
                        activeConversationId === conv.id ? "bg-blue-50" : ""
                      }`}
                      onClick={() => handleSelectConversation(conv.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {conv.title || "Untitled conversation"}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(conv.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); setDeletingConvId(conv.id); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); e.preventDefault(); setDeletingConvId(conv.id); } }}
                        className="ml-2 p-1 text-gray-400 hover:text-red-500 rounded flex-shrink-0"
                        title="Delete conversation"
                        aria-label="Delete conversation"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm flex justify-between items-center">
          {error}
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 ml-2" aria-label="Dismiss error">&times;</button>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isStreaming && (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-lg font-medium">How can I help?</p>
            <p className="text-sm mt-1">
              Ask me to manage your projects, tasks, or tags.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            {/* Tool call cards before assistant text */}
            {msg.role === "assistant" &&
              msg.toolCalls?.map((tc) => (
                <ToolCallCard key={tc.id} toolCall={tc} />
              ))}

            {/* Message bubble */}
            <div
              className={
                msg.role === "user"
                  ? "ml-12 bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2"
                  : "mr-12 bg-gray-100 text-gray-900 rounded-2xl rounded-bl-sm px-4 py-2"
              }
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {/* Streaming assistant message */}
        {isStreaming && (
          <div>
            {streamingToolCalls.map((tc) => (
              <ToolCallCard key={tc.id} toolCall={tc} />
            ))}
            {streamingContent && (
              <div className="mr-12 bg-gray-100 text-gray-900 rounded-2xl rounded-bl-sm px-4 py-2">
                <p className="whitespace-pre-wrap">{streamingContent}</p>
              </div>
            )}
            {!streamingContent && streamingToolCalls.length === 0 && (
              <div className="mr-12 bg-gray-100 text-gray-900 rounded-2xl rounded-bl-sm px-4 py-2">
                <p className="text-gray-400">Thinking...</p>
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            aria-label="Chat message"
            disabled={isStreaming}
            rows={1}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 resize-none"
          />
          <button
            onClick={sendMessage}
            disabled={isStreaming || !input.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
