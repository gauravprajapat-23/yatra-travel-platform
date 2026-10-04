const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const internalPathPattern = /^\/(?!\/)[a-zA-Z0-9/_-]*$/;

export function isValidSlug(value: string): boolean {
  return value.length >= 1 && value.length <= 120 && slugPattern.test(value);
}

export function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
}

export function isSafeInternalPath(value: string): boolean {
  return value.length > 0 && value.length <= 500 && internalPathPattern.test(value);
}

export function validateRedirect(input: {
  sourcePath: string;
  destinationPath: string;
  statusCode: number;
}): void {
  if (!isSafeInternalPath(input.sourcePath)) {
    throw new Error("Invalid redirect source path.");
  }

  if (!isSafeInternalPath(input.destinationPath)) {
    throw new Error("Invalid redirect destination path.");
  }

  if (input.sourcePath === input.destinationPath) {
    throw new Error("Redirect source and destination cannot match.");
  }

  if (input.statusCode !== 301 && input.statusCode !== 302) {
    throw new Error("Redirect status code must be 301 or 302.");
  }
}

export function shouldIndexContent(input: {
  publiclyVisible: boolean;
  robotsIndex: boolean;
}): boolean {
  return input.publiclyVisible && input.robotsIndex;
}
