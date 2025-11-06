import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "./app";
import MosquePage from "./pages/mosque-page";
import ChromecastPage from "./pages/chromecast-page";
import AdhanPage from "./pages/adhan-page";
import SchedulePage from "./pages/schedule-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <Navigate to="/schedule" replace />,
      },
      {
        path: "mosque",
        element: <MosquePage />,
      },
      {
        path: "chromecast",
        element: <ChromecastPage />,
      },
      {
        path: "adhan",
        element: <AdhanPage />,
      },
      {
        path: "schedule",
        element: <SchedulePage />,
      },
    ],
  },
]);
