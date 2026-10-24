"use client";

/** Asks the server, once, to delete the dead session cookie (D-365). */
import { useEffect } from "react";
import { clearStaleSessionAction } from "@/app/(auth)/actions";

export function ClearStaleSession({ csrfToken }: { csrfToken: string }) {
  useEffect(() => {
    void clearStaleSessionAction(csrfToken);
  }, [csrfToken]);
  return null;
}
