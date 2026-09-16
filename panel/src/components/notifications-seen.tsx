"use client";

/**
 * Opening the notification list is reading it (D-164). The owner dropped the
 * "mark all as read" button: whoever is on this page is looking at the list.
 *
 * The list is marked read once, on arrival, through the existing server
 * action, and the page is refreshed so the member menu's badge goes. It is
 * never done while the page renders on the server: a link prefetch must not
 * read a member's notifications for them.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { markNotificationsReadAction } from "@/app/social/actions";

export function NotificationsSeen({
  csrfToken,
  csrfField,
  hasUnread,
}: {
  csrfToken: string;
  /** The form field the action reads the token from; the constant lives server-side. */
  csrfField: string;
  hasUnread: boolean;
}) {
  const router = useRouter();
  const sent = useRef(false);

  useEffect(() => {
    if (!hasUnread || sent.current) return;
    sent.current = true;

    const form = new FormData();
    form.set(csrfField, csrfToken);
    void markNotificationsReadAction({}, form).then(() => router.refresh());
  }, [csrfField, csrfToken, hasUnread, router]);

  return null;
}

/**
 * The unread dot keeps the state the member arrived with, so the notices that
 * were new stay marked for this visit even though the list is already read.
 */
export function UnreadDot({ unread }: { unread: boolean }) {
  const [shown] = useState(unread);
  return (
    <span className={shown ? "notice-dot" : "notice-dot is-read"}>
      {shown && <span className="sr-only">Okunmadı</span>}
    </span>
  );
}
