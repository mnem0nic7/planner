import { useState, useCallback } from "react";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { ProjectView } from "./pages/ProjectView";
import { AllTasks } from "./pages/AllTasks";
import { DueSoon } from "./pages/DueSoon";
import { ChatPanel } from "./components/ChatPanel";
import { ChatBubble } from "./components/ChatBubble";

type View = "dashboard" | "project" | "all-tasks" | "due-soon";

function App() {
  const [view, setView] = useState<View>("dashboard");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSelectProject = (id: string) => {
    setActiveProjectId(id);
    setView("project");
  };

  const handleSelectView = (v: "dashboard" | "all-tasks" | "due-soon") => {
    setActiveProjectId(null);
    setView(v);
  };

  const handleDataChange = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  return (
    <>
      <Layout
        activeProjectId={activeProjectId}
        activeView={view}
        onSelectProject={handleSelectProject}
        onSelectView={handleSelectView}
        chatOpen={chatOpen}
        refreshKey={refreshKey}
      >
        {view === "dashboard" && <Dashboard key={refreshKey} onSelectProject={handleSelectProject} />}
        {view === "project" && activeProjectId && <ProjectView key={refreshKey} projectId={activeProjectId} />}
        {view === "all-tasks" && <AllTasks key={refreshKey} />}
        {view === "due-soon" && <DueSoon key={refreshKey} />}
      </Layout>

      {chatOpen ? (
        <ChatPanel
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          onDataChange={handleDataChange}
        />
      ) : (
        <ChatBubble onClick={() => setChatOpen(true)} />
      )}
    </>
  );
}

export default App;
