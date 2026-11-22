/** Old factory URLs (/tickets, /workflows, /factory-project) -> /factory/... (query kept). */
import { Navigate, useLocation } from "react-router";

const MOVED: Record<string, string> = {
  "/tickets": "/factory/tickets",
  "/workflows": "/factory/workflows",
  "/factory-project": "/factory/project",
};

export default function FactoryLegacyRedirect() {
  const { pathname, search } = useLocation();
  const key = Object.keys(MOVED).find((p) => pathname.endsWith(p));
  return (
    <Navigate
      to={`${key ? MOVED[key] : "/factory/tickets"}${search}`}
      replace
    />
  );
}
