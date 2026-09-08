/**
 * Object storage behind an adapter (specification §2 and §11).
 *
 * One bucket: article media and contract PDFs. The identity-document bucket
 * from D-009 was dropped in D-047.
 */
import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { env, isProduction } from "@/lib/env";
import { badRequest } from "@/lib/errors";

export type Bucket = "media";

export type StoredObject = { key: string; bucket: Bucket; size: number; mime: string };

export type StorageAdapter = {
  put(input: { bucket: Bucket; key: string; body: Buffer; mime: string }): Promise<void>;
  get(input: { bucket: Bucket; key: string }): Promise<Buffer>;
  remove(input: { bucket: Bucket; key: string }): Promise<void>;
  signedUrl(input: { bucket: Bucket; key: string; expiresInSeconds: number }): Promise<string>;
};

/* ------------------------------------------------------------------ */
/* Key generation                                                      */
/* ------------------------------------------------------------------ */

/**
 * File names from users are never reused. The stored key is derived from the
 * date and a uuid, so a crafted name cannot escape its prefix or collide.
 */
export function buildStorageKey(prefix: string, originalName: string): string {
  const extension = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, "");
  const today = new Date().toISOString().slice(0, 10);
  return `${prefix}/${today}/${randomUUID()}${extension}`;
}

/* ------------------------------------------------------------------ */
/* S3 adapter                                                          */
/* ------------------------------------------------------------------ */

function createS3Adapter(): StorageAdapter {
  const config = env();

  // The env default is the local MinIO address. In production that endpoint
  // cannot exist, so the adapter would hang and time out on every upload;
  // refusing fast with a clear message beats a function that dies silently.
  if (isProduction() && config.S3_ENDPOINT.includes("localhost")) {
    throw badRequest(
      "Nesne depolama ayarları eksik: S3_ENDPOINT üretimde yerel bir adrese işaret ediyor.",
    );
  }

  const client = new S3Client({
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    forcePathStyle: config.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY_ID,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    },
  });

  const bucketName = (_bucket: Bucket) => config.S3_BUCKET;

  return {
    async put({ bucket, key, body, mime }) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucketName(bucket),
          Key: key,
          Body: body,
          ContentType: mime,
        }),
      );
    },
    async get({ bucket, key }) {
      const result = await client.send(
        new GetObjectCommand({ Bucket: bucketName(bucket), Key: key }),
      );
      const bytes = await result.Body?.transformToByteArray();
      if (!bytes) throw new Error(`Object not found: ${key}`);
      return Buffer.from(bytes);
    },
    async remove({ bucket, key }) {
      await client.send(new DeleteObjectCommand({ Bucket: bucketName(bucket), Key: key }));
    },
    async signedUrl({ bucket, key, expiresInSeconds }) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket: bucketName(bucket), Key: key }), {
        expiresIn: expiresInSeconds,
      });
    },
  };
}

/* ------------------------------------------------------------------ */
/* Local disk adapter                                                  */
/* ------------------------------------------------------------------ */

/**
 * Writes objects under a local directory. Selected by setting `S3_ENDPOINT` to
 * `file://<dir>`, which is the Docker-free development path (DECISIONS.md
 * D-003). Not for production: there is no redundancy and no access control
 * beyond the file system.
 */
function createLocalDiskAdapter(root: string): StorageAdapter {
  const resolve = (bucket: Bucket, key: string) => {
    const full = path.resolve(root, bucket, key);
    // A key must never escape its bucket directory
    const base = path.resolve(root, bucket);
    if (!full.startsWith(base + path.sep)) throw new Error("Invalid storage key");
    return full;
  };

  return {
    async put({ bucket, key, body }) {
      const { mkdir, writeFile } = await import("node:fs/promises");
      const target = resolve(bucket, key);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, body);
    },
    async get({ bucket, key }) {
      const { readFile } = await import("node:fs/promises");
      return readFile(resolve(bucket, key));
    },
    async remove({ bucket, key }) {
      const { rm } = await import("node:fs/promises");
      await rm(resolve(bucket, key), { force: true });
    },
    async signedUrl({ bucket, key }) {
      // Served through the authorised /api/media route rather than a real URL
      return `/api/media/local?bucket=${bucket}&key=${encodeURIComponent(key)}`;
    },
  };
}

/** Keeps objects in a Map. Used by tests so they need no MinIO. */
export class MemoryStorageAdapter implements StorageAdapter {
  readonly objects = new Map<string, { body: Buffer; mime: string }>();

  private id(bucket: Bucket, key: string): string {
    return `${bucket}:${key}`;
  }

  async put({ bucket, key, body, mime }: { bucket: Bucket; key: string; body: Buffer; mime: string }) {
    this.objects.set(this.id(bucket, key), { body, mime });
  }

  async get({ bucket, key }: { bucket: Bucket; key: string }) {
    const found = this.objects.get(this.id(bucket, key));
    if (!found) throw new Error(`Object not found: ${key}`);
    return found.body;
  }

  async remove({ bucket, key }: { bucket: Bucket; key: string }) {
    this.objects.delete(this.id(bucket, key));
  }

  async signedUrl({ bucket, key }: { bucket: Bucket; key: string; expiresInSeconds: number }) {
    return `memory://${bucket}/${key}`;
  }

  clear(): void {
    this.objects.clear();
  }
}

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

let adapter: StorageAdapter | null = null;

export function setStorageAdapter(next: StorageAdapter): void {
  adapter = next;
}

export function getStorage(): StorageAdapter {
  if (!adapter) {
    if (process.env.NODE_ENV === "test") {
      adapter = new MemoryStorageAdapter();
    } else if (env().S3_ENDPOINT.startsWith("file://")) {
      adapter = createLocalDiskAdapter(env().S3_ENDPOINT.replace(/^file:\/\//, "") || ".storage");
    } else {
      adapter = createS3Adapter();
    }
  }
  return adapter;
}


