import { ApiClientError } from "./client";

const NETWORK_ERROR_MESSAGE =
  "Unable to reach the server. Check your connection and try again.";

export function getErrorMessage(error: unknown): string {
  return error instanceof ApiClientError ? error.message : NETWORK_ERROR_MESSAGE;
}

export function getFieldErrors(
  error: unknown,
): Record<string, string> | undefined {
  return error instanceof ApiClientError ? error.fields : undefined;
}
