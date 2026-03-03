import { useState, useCallback, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { ProjectView } from "./pages/ProjectView";
import { AllTasks } from "./pages/AllTasks";
import { DueSoon } from "./pages/DueSoon";
import { ChatPanel } from "./components/ChatPanel";
import { ChatBubble } from "./components/ChatBubble";
import { TagsPage } from "./pages/TagsPage";
import { TagTasks } from "./pages/TagTasks";

type View = "dashboard" | "project" | "all-tasks" | "due-soon" | "tags" | "tag-tasks";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Uncaught render error:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-gray-500 mb-4">{this.state.error.message}</p>
            <button
              onClick={() => this.setState({ error: null })}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [view, setView] = useState<View>("dashboard");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSelectProject = (id: string) => {
    setActiveProjectId(id);
    setActiveTagId(null);
    setView("project");
  };

  const handleSelectView = (v: "dashboard" | "all-tasks" | "due-soon" | "tags") => {
    setActiveProjectId(null);
    setActiveTagId(null);
    setView(v);
  };

  const handleSelectTag = (tagId: string) => {
    setActiveTagId(tagId);
    setActiveProjectId(null);
    setView("tag-tasks");
  };

  const handleDataChange = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  return (
    <ErrorBoundary>
      <Layout
        activeProjectId={activeProjectId}
        activeView={view}
        activeTagId={activeTagId}
        onSelectProject={handleSelectProject}
        onSelectView={handleSelectView}
        onSelectTag={handleSelectTag}
        chatOpen={chatOpen}
        refreshKey={refreshKey}
      >
        {view === "dashboard" && <Dashboard key={refreshKey} onSelectProject={handleSelectProject} />}
        {view === "project" && activeProjectId && <ProjectView key={refreshKey} projectId={activeProjectId} />}
        {view === "project" && !activeProjectId && <Dashboard key={refreshKey} onSelectProject={handleSelectProject} />}
        {view === "all-tasks" && <AllTasks key={refreshKey} />}
        {view === "due-soon" && <DueSoon key={refreshKey} />}
        {view === "tags" && <TagsPage key={refreshKey} onDataChange={handleDataChange} />}
        {view === "tag-tasks" && activeTagId && (
          <TagTasks key={refreshKey} tagId={activeTagId} onBack={() => handleSelectView("tags")} />
        )}
        {view === "tag-tasks" && !activeTagId && <TagsPage key={refreshKey} onDataChange={handleDataChange} />}
      </Layout>

      {chatOpen ? (
        <ChatPanel
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          onDataChange={handleDataChange}
          activeProjectId={activeProjectId}
        />
      ) : (
        <ChatBubble onClick={() => setChatOpen(true)} />
      )}
    </ErrorBoundary>
  );
}

export default App;
