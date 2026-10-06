export class JsonBodyError extends Error {
  constructor(
    message: string,
    public readonly code: "INVALID_JSON" | "BODY_TOO_LARGE",
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "JsonBodyError";
  }
}

export async function readJsonBody<T>(
  request: Request,
  maxBytes: number,
): Promise<T> {
  if (!Number.isInteger(maxBytes) || maxBytes < 256) {
    throw new Error("Invalid JSON body size limit.");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const declared = Number(contentLength);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new JsonBodyError(
        "Request body is too large.",
        "BODY_TOO_LARGE",
        413,
      );
    }
  }

  if (!request.body) {
    throw new JsonBodyError(
      "Request body must be valid JSON.",
      "INVALID_JSON",
      400,
    );
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new JsonBodyError(
          "Request body is too large.",
          "BODY_TOO_LARGE",
          413,
        );
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(body)) as T;
  } catch {
    throw new JsonBodyError(
      "Request body must be valid JSON.",
      "INVALID_JSON",
      400,
    );
  }
}
