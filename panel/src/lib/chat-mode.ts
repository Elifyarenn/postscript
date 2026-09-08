/**
 * The community chat's activity mode. When the mode is `disabled` the chat
 * stays visible but passive: the room is read-only and new messages are
 * refused, until an admin turns it back on from the System screen (D-056).
 *
 * The default is `disabled` — an absent setting means the chat is off.
 */
export type ChatMode = "enabled" | "disabled";

export function parseChatMode(value: string | null | undefined): ChatMode {
  return value === "enabled" ? "enabled" : "disabled";
}

/** May new chat messages be posted right now? */
export function isChatOpen(mode: ChatMode): boolean {
  return mode === "enabled";
}
