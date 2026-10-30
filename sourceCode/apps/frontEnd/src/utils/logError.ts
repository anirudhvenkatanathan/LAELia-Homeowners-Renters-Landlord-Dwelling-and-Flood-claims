/**
 * logError — shared frontend error logger.
 *
 * Logs the error to the console with context information.
 * In a production build this would also POST to the backend
 * /api/errors endpoint (or the GraphQL errorLog mutation).
 */
export function logError(error: unknown, context: string): void {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : JSON.stringify(error);

  const stack = error instanceof Error ? (error.stack ?? '') : '';

  console.error(
    `[ClaimTriage Error] ${context}: ${message}`,
    stack ? `\n${stack}` : ''
  );
}
