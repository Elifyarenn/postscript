/**
 * Object storage behind an adapter (specification §2 and §11).
 *
 * Two buckets: the ordinary one for article media and contract PDFs, and a
 * separate identity bucket that only admins can read, through signed URLs that
 * live for five minutes (DECISIONS.md D-009).
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
import { env } from "@/lib/env";

export type Bucket = "media" | "identity";

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
  const client = new S3Client({
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    forcePathStyle: config.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY_ID,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    },
  });

  const bucketName = (bucket: Bucket) =>
    bucket === "identity" ? config.S3_IDENTITY_BUCKET : config.S3_BUCKET;

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
    adapter = process.env.NODE_ENV === "test" ? new MemoryStorageAdapter() : createS3Adapter();
  }
  return adapter;
}

/** Identity documents: admin only, five minute window (§11). */
export async function signIdentityDocumentUrl(key: string): Promise<string> {
  return getStorage().signedUrl({ bucket: "identity", key, expiresInSeconds: 300 });
}
