import { useState } from "react";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { ProjectView } from "./pages/ProjectView";

type View = "dashboard" | "project" | "all-tasks" | "due-soon";

function App() {
  const [view, setView] = useState<View>("dashboard");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const handleSelectProject = (id: string) => {
    setActiveProjectId(id);
    setView("project");
  };

  const handleSelectView = (v: "dashboard" | "all-tasks" | "due-soon") => {
    setActiveProjectId(null);
    setView(v);
  };

  return (
    <Layout
      activeProjectId={activeProjectId}
      activeView={view}
      onSelectProject={handleSelectProject}
      onSelectView={handleSelectView}
    >
      {view === "dashboard" && <Dashboard onSelectProject={handleSelectProject} />}
      {view === "project" && activeProjectId && <ProjectView projectId={activeProjectId} />}
      <div className="p-8">
        {view === "all-tasks" && <h2 className="text-xl font-semibold">All Tasks</h2>}
        {view === "due-soon" && <h2 className="text-xl font-semibold">Due Soon</h2>}
      </div>
    </Layout>
  );
}

export default App;
