/**
 * Retry a function with exponential backoff
 * @param fn - The async function to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param initialDelay - Initial delay in milliseconds (default: 1000)
 * @param maxDelay - Maximum delay in milliseconds (default: 10000)
 * @param backoffMultiplier - Multiplier for exponential backoff (default: 2)
 * @returns The result of the function or throws the last error
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    onRetry?: (error: Error, attempt: number) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    onRetry
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        if (onRetry) {
          onRetry(lastError, attempt + 1);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Increase delay for next attempt (exponential backoff)
        delay = Math.min(delay * backoffMultiplier, maxDelay);
      }
    }
  }

  // All retries exhausted, throw the last error
  throw lastError!;
}

/**
 * Retry a fetch request with exponential backoff
 * Automatically retries on network errors and 5xx server errors
 */
export async function retryFetch(
  url: string,
  options?: RequestInit & {
    maxRetries?: number;
    onRetry?: (error: Error, attempt: number) => void;
  }
): Promise<Response> {
  const { maxRetries, onRetry, ...fetchOptions } = options || {};

  return retryWithBackoff(
    async () => {
      const response = await fetch(url, fetchOptions);
      
      // Retry on 5xx server errors
      if (response.status >= 500) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }
      
      return response;
    },
    {
      maxRetries,
      onRetry,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2
    }
  );
}
