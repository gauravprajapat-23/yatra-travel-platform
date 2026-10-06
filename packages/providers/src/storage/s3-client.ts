import { createHash, createHmac } from "node:crypto";
import { getS3StorageConfig, type S3StorageConfig } from "./s3-config";

export type StoragePutInput = {
  objectKey: string;
  body: Uint8Array;
  contentType: string;
  cacheControl?: string;
};

export type StoragePutResult = {
  objectKey: string;
  publicUrl: string | null;
};

function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | Uint8Array | string, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function canonicalPath(bucket: string, objectKey: string): string {
  const keyPath = objectKey.split("/").map(encodePathSegment).join("/");
  return `/${encodePathSegment(bucket)}/${keyPath}`;
}

function amzDate(date: Date): { dateStamp: string; amz: string } {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { dateStamp: iso.slice(0, 8), amz: iso };
}

function signingKey(secret: string, dateStamp: string, region: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

function buildPublicUrl(config: S3StorageConfig, objectKey: string): string | null {
  if (!config.publicBaseUrl) return null;
  return `${config.publicBaseUrl}/${objectKey.split("/").map(encodePathSegment).join("/")}`;
}

async function signedRequest(input: {
  method: "PUT" | "DELETE";
  objectKey: string;
  body?: Uint8Array;
  contentType?: string;
  cacheControl?: string;
  now?: Date;
}) {
  const config = getS3StorageConfig();
  const now = input.now ?? new Date();
  const { dateStamp, amz } = amzDate(now);
  const path = canonicalPath(config.bucket, input.objectKey);
  const url = new URL(config.endpoint + path);
  const payloadHash = sha256Hex(input.body ?? new Uint8Array());

  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amz,
  };

  if (input.contentType) headers["content-type"] = input.contentType;
  if (input.cacheControl) headers["cache-control"] = input.cacheControl;

  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${headers[name]!.trim()}\n`)
    .join("");
  const signedHeaders = signedHeaderNames.join(";");

  const canonicalRequest = [
    input.method,
    url.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amz,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signature = createHmac("sha256", signingKey(config.secretAccessKey, dateStamp, config.region))
    .update(stringToSign)
    .digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const requestHeaders = new Headers();
  for (const [name, value] of Object.entries(headers)) requestHeaders.set(name, value);
  requestHeaders.set("authorization", authorization);

  const response = await fetch(url, {
    method: input.method,
    headers: requestHeaders,
    body: input.body ? Buffer.from(input.body) : undefined,
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1000);
    throw new Error(`S3 ${input.method} failed (${response.status}): ${detail}`);
  }

  return config;
}

export async function putStorageObject(input: StoragePutInput): Promise<StoragePutResult> {
  const config = await signedRequest({
    method: "PUT",
    objectKey: input.objectKey,
    body: input.body,
    contentType: input.contentType,
    cacheControl: input.cacheControl ?? "public, max-age=31536000, immutable",
  });

  return {
    objectKey: input.objectKey,
    publicUrl: buildPublicUrl(config, input.objectKey),
  };
}

export async function deleteStorageObject(objectKey: string): Promise<void> {
  await signedRequest({ method: "DELETE", objectKey });
}
