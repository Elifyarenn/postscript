/**
 * Traffic records for user content (5651 m. 5, D-088).
 *
 * As a hosting provider the magazine has to be able to say who put a comment
 * or a message online, from where and when, for one year. Every service that
 * stores user content calls `recordTraffic` inside the same transaction as the
 * content itself, so a row can never exist without its record.
 */
import "server-only";
import { lt } from "drizzle-orm";
import { db } from "@/db/client";
import { trafficLogs } from "@/db/schema";
import type { Executor } from "@/lib/audit";

/** 5651 m. 5 asks for one year; not a day less. */
export const TRAFFIC_RETENTION_DAYS = 365;

export type TrafficEntry = {
  userId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  ip: string | null;
  userAgent: string | null;
};

export async function recordTraffic(entry: TrafficEntry, executor: Executor = db): Promise<void> {
  await executor.insert(trafficLogs).values(entry);
}

/** The moment before which a record has served its year. */
export function trafficCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - TRAFFIC_RETENTION_DAYS * 86_400_000);
}

/** Deletes the records older than the retention period; returns how many went. */
export async function pruneTrafficLogs(now: Date = new Date()): Promise<number> {
  const removed = await db
    .delete(trafficLogs)
    .where(lt(trafficLogs.createdAt, trafficCutoff(now)))
    .returning({ id: trafficLogs.id });
  return removed.length;
}
