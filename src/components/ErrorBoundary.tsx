"use client";

import { Component, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback UI to show when error occurs */
  fallback?: ReactNode;
  /** Optional callback when error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Optional title for error display */
  title?: string;
  /** Show retry button (default: true) */
  showRetry?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary component for graceful UI degradation.
 * Catches JavaScript errors anywhere in child component tree.
 *
 * @example
 * <ErrorBoundary fallback={<div>Something went wrong</div>}>
 *   <MyComponent />
 * </ErrorBoundary>
 *
 * @example
 * <ErrorBoundary
 *   title="Chart Error"
 *   onError={(error) => logError(error)}
 * >
 *   <PriceChart />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });

    // Log error to console for debugging
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, title = "Something went wrong", showRetry = true } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-800">{title}</h3>
              <p className="mt-1 text-sm text-red-700">
                {error?.message || "An unexpected error occurred"}
              </p>
              {showRetry && (
                <button
                  onClick={this.handleRetry}
                  className="mt-3 inline-flex items-center rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

/**
 * Lightweight error display for inline errors
 */
export function ErrorDisplay({
  message,
  title = "Error",
  onRetry,
}: {
  message: string;
  title?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded border border-red-200 bg-red-50 p-4 text-sm">
      <div className="font-medium text-red-800">{title}</div>
      <div className="mt-1 text-red-700">{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 text-red-800 underline hover:no-underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/**
 * Loading state placeholder
 */
export function LoadingFallback({
  message = "Loading...",
}: {
  message?: string;
}) {
  return (
    <div className="flex items-center justify-center p-6 text-neutral-500">
      <div className="animate-pulse">{message}</div>
    </div>
  );
}

/**
 * Empty state placeholder
 */
export function EmptyState({
  title = "No data",
  message = "No data is available at this time.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="rounded border border-neutral-200 bg-neutral-50 p-6 text-center">
      <div className="text-sm font-medium text-neutral-600">{title}</div>
      <div className="mt-1 text-sm text-neutral-500">{message}</div>
    </div>
  );
}

export default ErrorBoundary;
