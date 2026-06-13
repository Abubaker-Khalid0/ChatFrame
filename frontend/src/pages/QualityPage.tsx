import { useLocation, useNavigate } from 'react-router-dom';
import { QualityReportScreen } from '../features/quality/QualityReportScreen';

/** Fallback identifier when no import forwarded a real project (mock flow). */
const MOCK_PROJECT_ID = 'mock-project';

/**
 * Wizard step 3: the quality report. Reads the backend report and gates
 * progression to the preview on the absence of a fatal error (US8). A
 * completed import forwards its `projectId` via navigation state (007
 * FR-022); without one the screen falls back to the mock placeholder.
 */
export function QualityPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const projectId = (location.state as { projectId?: string } | null)?.projectId ?? MOCK_PROJECT_ID;
  return (
    <QualityReportScreen
      projectId={projectId}
      onBack={() => navigate('/import')}
      onContinue={() => navigate('/preview', { state: { projectId } })}
    />
  );
}
