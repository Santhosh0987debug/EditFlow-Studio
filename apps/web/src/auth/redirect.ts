export function getRedirectPath(state: unknown): string {
  if (state && typeof state === "object" && "from" in state) {
    const from = (state as { from?: unknown }).from;

    if (
      typeof from === "string" &&
      from.startsWith("/") &&
      !from.startsWith("//")
    ) {
      return from;
    }
  }

  return "/dashboard";
}
