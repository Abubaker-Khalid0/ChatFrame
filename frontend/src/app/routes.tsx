import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { WelcomePage } from '../pages/WelcomePage';
import { NextStepPage } from '../pages/NextStepPage';
import { ChatPickerPage } from '../pages/ChatPickerPage';
import { ConnectPage } from '../pages/ConnectPage';
import { ImportPage } from '../pages/ImportPage';
import { ImportProgressPage } from '../pages/ImportProgressPage';
import { QualityPage } from '../pages/QualityPage';
import { PreviewPage } from '../pages/PreviewPage';
import { ExportPage } from '../pages/ExportPage';
import { ExportCompletePage } from '../pages/ExportCompletePage';
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
      // WhatsApp connection step (spec 005).
      { path: 'connect', element: <ConnectPage /> },
      // Wizard steps (mock-data flow, FR-009).
      { path: 'chat-picker', element: <ChatPickerPage /> },
      { path: 'import', element: <ImportPage /> },
      { path: 'import/progress', element: <ImportProgressPage /> },
      { path: 'quality', element: <QualityPage /> },
      { path: 'preview', element: <PreviewPage /> },
      { path: 'export', element: <ExportPage /> },
      { path: 'export/complete', element: <ExportCompletePage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
