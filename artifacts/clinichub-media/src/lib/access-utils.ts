export const EDITORIAL_ACCESS_DENIED_EVENT = 'birch:editorial-access-denied';

export function isAccessError(error: unknown): error is { status: 401 | 403 } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    ((error as any).status === 401 || (error as any).status === 403)
  );
}

export function notifyEditorialAccessDenied(error: unknown): void {
  if (!isAccessError(error)) return;
  window.dispatchEvent(
    new CustomEvent(EDITORIAL_ACCESS_DENIED_EVENT, {
      detail: { status: error.status },
    }),
  );
}
