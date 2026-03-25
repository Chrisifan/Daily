import { createBrowserRouter, Outlet } from "react-router-dom";
import { HomePage } from "../../features/home/HomePage";
import { SchedulePage } from "../../features/schedule/SchedulePage";
import { WorkspaceListPage } from "../../features/workspace/WorkspaceListPage";
import { WorkspaceDetailPage } from "../../features/workspace/WorkspaceDetailPage";
import { AppLayout } from "../layout/AppLayout";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout><Outlet /></AppLayout>,
    children: [
      {
        index: true,
        element: <HomePage />
      },
      {
        path: "schedule",
        element: <SchedulePage />
      },
      {
        path: "workspaces",
        element: <WorkspaceListPage />
      },
      {
        path: "workspace/:id",
        element: <WorkspaceDetailPage />
      }
    ]
  }
]);
