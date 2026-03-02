import { useState } from "react";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { ProjectView } from "./pages/ProjectView";
import { AllTasks } from "./pages/AllTasks";
import { DueSoon } from "./pages/DueSoon";

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
      {view === "all-tasks" && <AllTasks />}
      {view === "due-soon" && <DueSoon />}
    </Layout>
  );
}

export default App;
