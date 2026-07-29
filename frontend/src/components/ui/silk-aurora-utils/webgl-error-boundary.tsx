import React from "react";

interface WebGLErrorBoundaryProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
}

export class WebGLErrorBoundary extends React.Component<WebGLErrorBoundaryProps> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export function WebGLFallback({ className }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        background: "linear-gradient(135deg, #050507 0%, #14151d 50%, #1a1a2e 100%)",
      }}
    />
  );
}
