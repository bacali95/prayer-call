import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { AppShell } from "@/components/shell/app-shell";
import { RouteError } from "@/components/shell/route-error";

export const routes: RouteObject[] = [
  {
    path: "/",
    Component: AppShell,
    ErrorBoundary: RouteError,
    children: [
      { index: true, lazy: () => import("@/pages/today-page").then((m) => ({ Component: m.default })) },
      { path: "mosque", lazy: () => import("@/pages/mosque-page").then((m) => ({ Component: m.default })) },
      { path: "speaker", lazy: () => import("@/pages/speaker-page").then((m) => ({ Component: m.default })) },
      { path: "chromecast", element: <Navigate to="/speaker" replace /> },
      { path: "schedule", element: <Navigate to="/" replace /> },
      { path: "adhan", lazy: () => import("@/pages/adhan-page").then((m) => ({ Component: m.default })) },
      { path: "settings", lazy: () => import("@/pages/settings-page").then((m) => ({ Component: m.default })) },
      { path: "system", lazy: () => import("@/pages/system-page").then((m) => ({ Component: m.default })) },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
  {
    path: "/screensaver",
    ErrorBoundary: RouteError,
    lazy: () => import("@/pages/screensaver-page").then((m) => ({ Component: m.default })),
  },
];

export const router = createBrowserRouter(routes);
