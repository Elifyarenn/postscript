/**
 * The chat activity mode: only the exact value "enabled" opens the chat;
 * everything else (absent setting, junk value) is passive (D-056).
 */
import { describe, expect, it } from "vitest";
import { isChatOpen, parseChatMode } from "@/lib/chat-mode";

describe("chat mode helpers", () => {
  it("treats anything but 'enabled' as disabled", () => {
    expect(parseChatMode(undefined)).toBe("disabled");
    expect(parseChatMode(null)).toBe("disabled");
    expect(parseChatMode("disabled")).toBe("disabled");
    expect(parseChatMode("enabled")).toBe("enabled");
  });

  it("opens the chat only while enabled", () => {
    expect(isChatOpen("enabled")).toBe(true);
    expect(isChatOpen("disabled")).toBe(false);
  });
});