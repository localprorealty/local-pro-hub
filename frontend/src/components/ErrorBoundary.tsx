import { Component, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
  title?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message }
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, message: '' })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="relative flex min-h-svh flex-col items-start justify-center px-8 py-16">
          <p className="mb-2 text-sm tracking-widest text-[var(--color-gold)] uppercase">
            Something went wrong
          </p>
          <h1 className="mb-3 font-[family-name:var(--font-display)] text-2xl text-[var(--color-white)]">
            {this.props.title ?? 'Page error'}
          </h1>
          <p className="mb-8 max-w-md text-sm text-[var(--color-text-secondary)]">
            {this.state.message || 'An unexpected error occurred.'}
          </p>
          <Button type="button" variant="default" onClick={this.handleRetry}>
            Try again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
