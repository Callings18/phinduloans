import { toast } from "@/hooks/use-toast";

/**
 * Enhanced error handling utility
 * Replaces console.error with user-facing notifications and error tracking
 */

interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

class ErrorHandler {
  private buildCorrelationId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private errorLog: Array<{
    error: Error;
    context: ErrorContext;
    timestamp: Date;
  }> = [];

  /**
   * Log and display error to user
   */
  handleError(
    error: Error | string | unknown,
    context?: ErrorContext,
    showToast: boolean = true
  ) {
    // Normalize error to Error object
    const errorObj = error instanceof Error 
      ? error 
      : new Error(typeof error === 'string' ? error : 'An unexpected error occurred');

    const correlationId = context?.correlationId || this.buildCorrelationId();
    const normalizedContext: ErrorContext = {
      ...(context || {}),
      correlationId,
    };

    // Log to console in development (Vite: import.meta.env.DEV)
    if (import.meta.env.DEV) {
      console.error('[Error Handler]', errorObj, normalizedContext);
    }

    // Store in error log (keep last 100 errors)
    this.errorLog.push({
      error: errorObj,
      context: normalizedContext,
      timestamp: new Date(),
    });
    if (this.errorLog.length > 100) {
      this.errorLog.shift();
    }

    // Send to error tracking service (if configured)
    this.trackError(errorObj, normalizedContext);

    // Show user-friendly toast notification
    if (showToast) {
      const userMessage = this.getUserFriendlyMessage(errorObj, normalizedContext);
      
      toast({
        title: "Error",
        description: userMessage,
        variant: "destructive",
        duration: 5000,
      });
    }

    return errorObj;
  }

  /**
   * Get user-friendly error message
   */
  private getUserFriendlyMessage(error: Error, context?: ErrorContext): string {
    const errorMessage = error.message.toLowerCase();

    // Network errors
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return "Network error. Please check your internet connection and try again.";
    }

    // Authentication errors
    if (errorMessage.includes('auth') || errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
      return "Your session has expired. Please log in again.";
    }

    // Permission errors
    if (errorMessage.includes('permission') || errorMessage.includes('forbidden') || errorMessage.includes('403')) {
      return "You don't have permission to perform this action.";
    }

    // Not found errors
    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      return "The requested resource was not found.";
    }

    // Server errors
    if (errorMessage.includes('server') || errorMessage.includes('500')) {
      return "Server error. Please try again in a moment. If the problem persists, contact support.";
    }

    // Validation errors
    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return error.message || "Please check your input and try again.";
    }

    // Context-specific messages
    if (context?.action) {
      if (context.action.includes('upload')) {
        return "Failed to upload file. Please check the file size and format, then try again.";
      }
      if (context.action.includes('save') || context.action.includes('create') || context.action.includes('update')) {
        return "Failed to save changes. Please try again.";
      }
      if (context.action.includes('delete')) {
        return "Failed to delete. Please try again.";
      }
      if (context.action.includes('send')) {
        return "Failed to send notification. Please try again.";
      }
    }

    // Generic fallback
    return error.message || "An unexpected error occurred. Please try again.";
  }

  /**
   * Track error to external service (Sentry, LogRocket, etc.)
   */
  private trackError(error: Error, context?: ErrorContext) {
    // TODO: Integrate with error tracking service
    // Example for Sentry:
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, {
    //     contexts: {
    //       custom: context,
    //     },
    //   });
    // }

    // For now, log to console with structured data
    if (import.meta.env.PROD) {
      // In production, you could send to your logging endpoint
      // fetch('/api/log-error', {
      //   method: 'POST',
      //   body: JSON.stringify({ error: error.message, stack: error.stack, context }),
      // });
    }
  }

  /**
   * Get recent errors (for debugging/admin)
   */
  getRecentErrors(limit: number = 10) {
    return this.errorLog.slice(-limit);
  }

  /**
   * Clear error log
   */
  clearErrorLog() {
    this.errorLog = [];
  }

  /**
   * Handle async errors with retry logic
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    options: {
      maxRetries?: number;
      retryDelay?: number;
      context?: ErrorContext;
      onRetry?: (attempt: number) => void;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      context,
      onRetry,
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          if (onRetry) {
            onRetry(attempt);
          }
          
          // Exponential backoff
          const delay = retryDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          continue;
        }
        
        // Max retries reached
        this.handleError(lastError, {
          ...context,
          action: `${context?.action || 'operation'} (after ${maxRetries} retries)`,
        });
        throw lastError;
      }
    }

    throw lastError || new Error('Unknown error');
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();

// Export convenience functions
export const handleError = (error: Error | string | unknown, context?: ErrorContext, showToast?: boolean) => {
  return errorHandler.handleError(error, context, showToast);
};

export const withRetry = <T>(
  fn: () => Promise<T>,
  options?: Parameters<typeof errorHandler.withRetry<T>>[1]
) => {
  return errorHandler.withRetry(fn, options);
};
