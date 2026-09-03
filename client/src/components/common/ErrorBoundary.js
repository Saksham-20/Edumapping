// client/src/components/common/ErrorBoundary.js
import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Button, Card } from '../ui';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // No reporting service is wired up yet, so the console is the only record
    // a crash leaves behind. Keep it until one exists.
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-bone-50 px-5 py-16">
        <Card className="w-full max-w-md text-center">
          <span
            aria-hidden="true"
            className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-red-600/25 bg-red-50 text-red-700"
          >
            <ExclamationTriangleIcon className="h-6 w-6" strokeWidth={1.6} />
          </span>
          <h1 className="font-display text-xl font-bold tracking-tight text-ink-950">
            Something went wrong
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-600">
            An unexpected error stopped this page from rendering. Trying again will re-mount it;
            refreshing reloads the app from scratch.
          </p>

          {/*
            The stack is a development aid, not something to show a real user —
            it leaks internal structure and means nothing to them.
          */}
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-5 rounded-xl border border-ink-950/15 bg-bone-100 p-3 text-left">
              <summary className="cursor-pointer text-sm font-semibold text-ink-800">
                Error details (development only)
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-ink-700">
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}

          <div className="mt-6 flex gap-3">
            <Button onClick={this.handleReset} fullWidth>
              Try again
            </Button>
            <Button variant="secondary" fullWidth onClick={() => window.location.reload()}>
              Refresh page
            </Button>
          </div>
        </Card>
      </main>
    );
  }
}

export default ErrorBoundary;
