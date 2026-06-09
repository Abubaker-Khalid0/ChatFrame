import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { WelcomePage } from '../pages/WelcomePage';
import { NextStepPage } from '../pages/NextStepPage';
import { useLanguageStore } from '../stores/useLanguageStore';

/**
 * Route guard for the welcome screen: returning users who have already chosen a
 * language skip the welcome screen and land on the next step (FR-021, AC-4).
 */
function WelcomeRoute() {
  const hasChosen = useLanguageStore((s) => s.hasChosen);
  return hasChosen ? <Navigate to="/next" replace /> : <WelcomePage />;
}

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <WelcomeRoute /> },
      { path: 'next', element: <NextStepPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
