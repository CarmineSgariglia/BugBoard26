import { ForgotPasswordPage } from "../features/auth/ForgotPasswordPage";
import { ForgotPasswordResetPage } from "../features/auth/ForgotPasswordResetPage";
import { ForgotPasswordVerifyPage } from "../features/auth/ForgotPasswordVerifyPage";
import { LoginPageV2 } from "../features/auth/LoginPageV2";
import { IssuesPage } from "../features/issues/IssuesPage";
import { ProjectsPage } from "../features/projects/ProjectsPage";

function currentPath() {
  return window.location.pathname;
}

export function AppRouter() {
  const path = currentPath();

  if (path === "/login" || path === "/") return <LoginPageV2 />;
  if (path === "/forgot-password") return <ForgotPasswordPage />;
  if (path === "/forgot-password/verify") return <ForgotPasswordVerifyPage />;
  if (path === "/forgot-password/reset") return <ForgotPasswordResetPage />;
  if (path === "/projects") return <ProjectsPage />;
  if (path.startsWith("/projects/") || path.startsWith("/issues/")) return <IssuesPage />;

  window.history.replaceState({}, "", "/login");
  return <LoginPageV2 />;
}
