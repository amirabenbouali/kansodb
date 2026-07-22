import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  label: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { error: null };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  public componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Intentionally no console logging in production UI; the panel-level fallback keeps the app usable.
  }

  public render() {
    if (this.state.error !== null) {
      return (
        <section className="panel-error-boundary" role="alert">
          <strong>{this.props.label} could not render.</strong>
          <span>{this.state.error.message}</span>
          <button type="button" onClick={() => this.setState({ error: null })}>Retry</button>
        </section>
      );
    }

    return this.props.children;
  }
}
