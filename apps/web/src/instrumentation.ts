import type { Instrumentation } from "next";

function safePath(value: string): string {
  const raw = value.trim();
  if (!raw) return "/";

  try {
    const parsed = new URL(raw, "http://localhost");
    return parsed.pathname.slice(0, 300) || "/";
  } catch {
    return raw.split("?")[0]?.split("#")[0]?.slice(0, 300) || "/";
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const event = {
    level: "error",
    event: "next_request_error",
    timestamp: new Date().toISOString(),
    errorName: error.name?.slice(0, 120) || "Error",
    digest:
      typeof error.digest === "string"
        ? error.digest.slice(0, 160)
        : null,
    method: request.method?.slice(0, 16) || "UNKNOWN",
    path: safePath(request.path ?? "/"),
    routerKind: context.routerKind,
    routePath: safePath(context.routePath ?? "/"),
    routeType: context.routeType,
    renderSource: context.renderSource ?? null,
    revalidateReason: context.revalidateReason ?? null,
    deploymentCommit:
      process.env.VERCEL_GIT_COMMIT_SHA?.trim().slice(0, 64) ||
      process.env.GIT_COMMIT_SHA?.trim().slice(0, 64) ||
      null,
    deploymentEnvironment:
      process.env.VERCEL_ENV?.trim().slice(0, 32) ||
      process.env.NODE_ENV?.slice(0, 32) ||
      null,
  };

  console.error(JSON.stringify(event));
};
