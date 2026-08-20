import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { DashboardShell } from '../dashboard/DashboardShell';

/**
 * The app is now a single, state-driven dashboard (no per-step routes). The
 * primary route renders the dashboard; every legacy wizard path
 * (/connect, /chat-picker, /import, /quality, /preview, /export, …) and any
 * unknown path redirects to it. The active stage is resolved from
 * {@link useWorkflowStore} (persisted to sessionStorage), so a redirect or
 * refresh always lands on a valid stage rather than a broken view.
 */
const router = createBrowserRouter([
  { path: '/', element: <DashboardShell /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
