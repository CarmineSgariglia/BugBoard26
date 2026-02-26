import { type ReactElement } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginScreen } from "./features/auth/LoginScreen";
import { RetrieveStep1Screen } from "./features/auth/RetrieveStep1Screen";
import { RetrieveStep2Screen } from "./features/auth/RetrieveStep2Screen";
import { ProjectsScreen } from "./features/projects/ProjectsScreen";
import { ProjectIssuesScreen } from "./features/projects/ProjectIssuesScreen";
import { ManageAccountSettingsPage } from "./features/settings/ManageAccountSettingsPage";
import { useAuth } from "./contexts/AuthContext";

function RequireAuth({ children }: { children: ReactElement }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen bg-[#0D0D12]" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PublicOnly({ children }: { children: ReactElement }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen bg-[#0D0D12]" />;
  }

  if (user) {
    return <Navigate to="/projects" replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route
          path="/login"
          element={
            <PublicOnly>
              <LoginScreen />
            </PublicOnly>
          }
        />
        <Route
          path="/forgot-password"
          element={<RetrieveStep1Screen />}
        />
        <Route
          path="/forgot-password/verify"
          element={<RetrieveStep2Screen />}
        />
        <Route
          path="/projects"
          element={
            <RequireAuth>
              <ProjectsScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/projects/:projectId/issues"
          element={
            <RequireAuth>
              <ProjectIssuesScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <ManageAccountSettingsPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
