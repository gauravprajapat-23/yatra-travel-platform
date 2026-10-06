export type S3StorageConfig = {
  bucket: string;
  region: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string | null;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for S3 storage.`);
  return value;
}

export function getS3StorageConfig(): S3StorageConfig {
  const provider = (process.env.STORAGE_PROVIDER ?? "s3").trim().toLowerCase();
  if (provider !== "s3") {
    throw new Error(`Unsupported STORAGE_PROVIDER: ${provider}`);
  }

  const endpoint = requireEnv("STORAGE_ENDPOINT").replace(/\/$/, "");

  return {
    bucket: requireEnv("STORAGE_BUCKET"),
    region: requireEnv("STORAGE_REGION"),
    endpoint,
    accessKeyId: requireEnv("STORAGE_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("STORAGE_SECRET_ACCESS_KEY"),
    publicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL?.trim().replace(/\/$/, "") || null,
  };
}
