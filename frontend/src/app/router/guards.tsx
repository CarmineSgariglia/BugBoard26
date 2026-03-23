import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "@features/auth";

export function RequireAuth({ children }: { children: ReactElement }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen bg-[#11131A]" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export function PublicOnly({ children }: { children: ReactElement }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen bg-[#11131A]" />;
  }

  if (user) {
    return <Navigate to="/projects" replace />;
  }

  return children;
}
