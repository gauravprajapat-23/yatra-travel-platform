import { randomUUID } from "node:crypto";
import { deleteStorageObject, putStorageObject } from "../src/storage/s3-client";

async function main() {
  const objectKey = `health/storage-${randomUUID()}.txt`;
  const body = new TextEncoder().encode("yatra-storage-connectivity-check");

  console.log("Storage connectivity drill: creating temporary object...");
  const stored = await putStorageObject({
    objectKey,
    body,
    contentType: "text/plain",
    cacheControl: "no-store",
  });

  console.log("PUT succeeded.");
  console.log("Public URL configured:", Boolean(stored.publicUrl));

  console.log("Deleting temporary object...");
  await deleteStorageObject(objectKey);
  console.log("DELETE succeeded.");
  console.log("Storage connectivity drill passed.");
}

main().catch((error) => {
  console.error(
    "Storage connectivity drill failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
