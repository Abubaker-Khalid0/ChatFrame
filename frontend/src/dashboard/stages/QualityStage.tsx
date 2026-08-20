import { QualityReportScreen } from '../../features/quality/QualityReportScreen';
import { useWorkflowStore } from '../../stores/useWorkflowStore';

/**
 * Quality report stage (US8). Reuses the existing {@link QualityReportScreen},
 * which renders the backend report verbatim and gates progression on the
 * absence of a fatal error. The projectId now comes from the workflow store.
 */
export function QualityStage() {
  const projectId = useWorkflowStore((s) => s.projectId) ?? '';
  const goToStage = useWorkflowStore((s) => s.goToStage);
  const goToPreview = useWorkflowStore((s) => s.goToPreview);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl justify-center px-4 py-8 md:px-6">
        <QualityReportScreen
          projectId={projectId}
          onBack={() => goToStage('import-config')}
          onContinue={() => goToPreview()}
        />
      </div>
    </div>
  );
}
