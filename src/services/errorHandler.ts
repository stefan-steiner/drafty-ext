export interface ErrorResponse {
  success: false;
  error: string;
}

export class ErrorHandler {
  private static instance: ErrorHandler;

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Standardize error messages for consistent user experience
   */
  static getErrorMessage(error: any, context: string = 'operation'): string {
    // Handle network/connection errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return 'Unable to connect to server. Please check your internet connection and try again.';
    }

    // Handle specific error messages from API responses
    if (typeof error === 'string') {
      return error;
    }

    // Handle error objects with message property
    if (error && typeof error === 'object' && error.message) {
      return error.message;
    }

    // Handle error objects with error property (API responses)
    if (error && typeof error === 'object' && error.error) {
      return error.error;
    }

    // Default fallback
    return `An error occurred during ${context}. Please try again.`;
  }

  /**
   * Check if an error is a network/connection error
   */
  static isNetworkError(error: any): boolean {
    return (
      error instanceof TypeError &&
      error.message.includes('fetch')
    ) || (
      error &&
      typeof error === 'object' &&
      error.message &&
      error.message.includes('Network')
    );
  }

  /**
   * Check if an error is related to authentication
   */
  static isAuthError(error: any): boolean {
    if (typeof error === 'string') {
      return error.toLowerCase().includes('invalid') ||
             error.toLowerCase().includes('unauthorized') ||
             error.toLowerCase().includes('credentials');
    }

    if (error && typeof error === 'object' && error.error) {
      const errorMsg = error.error.toLowerCase();
      return errorMsg.includes('invalid') ||
             errorMsg.includes('unauthorized') ||
             errorMsg.includes('credentials');
    }

    return false;
  }

  /**
   * Check if an error is related to email already being in use
   */
  static isEmailExistsError(error: any): boolean {
    if (typeof error === 'string') {
      return error.toLowerCase().includes('already exists') ||
             error.toLowerCase().includes('email already');
    }

    if (error && typeof error === 'object' && error.error) {
      const errorMsg = error.error.toLowerCase();
      return errorMsg.includes('already exists') ||
             errorMsg.includes('email already');
    }

    return false;
  }
}