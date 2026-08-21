import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useConfig } from "@/context/ConfigContext";

// First-Run Experience guard: block dashboard access when RELAY_SYS_CONFIG
// is missing or invalid, redirecting to /setup.
export default function RouteGuard({ children }) {
  const { isConfigured } = useConfig();

  if (!isConfigured) {
    return <Navigate to="/setup" replace />;
  }

  return children ? children : <Outlet />;
}
