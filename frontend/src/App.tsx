import { AppProviders } from './app/providers';
import { AppRouter } from './app/routes';
import { ErrorBoundary } from './components/layout/ErrorBoundary';

export function App() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </ErrorBoundary>
  );
}

export default App;
