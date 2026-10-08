import { describe, expect, it } from "vitest";
import {
  CHAT_AT_BOTTOM_PX,
  chatDistanceFromBottom,
  isChatNearBottom,
  snapChatToBottom,
} from "@/lib/chatScroll";

function box(partial: { clientHeight: number; scrollHeight: number; scrollTop: number }) {
  return { ...partial };
}

describe("chatScroll", () => {
  it("treats the 300px LobeHub threshold as still-at-bottom", () => {
    const atThreshold = box({
      clientHeight: 800,
      scrollHeight: 2000,
      scrollTop: 2000 - 800 - 300,
    });
    expect(chatDistanceFromBottom(atThreshold)).toBe(300);
    expect(isChatNearBottom(atThreshold)).toBe(true);
    expect(isChatNearBottom(atThreshold, CHAT_AT_BOTTOM_PX - 1)).toBe(false);

    const pastThreshold = box({
      clientHeight: 800,
      scrollHeight: 2000,
      scrollTop: 2000 - 800 - 301,
    });
    expect(chatDistanceFromBottom(pastThreshold)).toBe(301);
    expect(isChatNearBottom(pastThreshold)).toBe(false);
  });

  it("is not near bottom when the user has scrolled up", () => {
    const el = box({ clientHeight: 800, scrollHeight: 2000, scrollTop: 0 });
    expect(isChatNearBottom(el)).toBe(false);
  });

  it("snapChatToBottom writes scrollHeight onto scrollTop", () => {
    const el = box({ clientHeight: 800, scrollHeight: 1600, scrollTop: 10 });
    snapChatToBottom(el);
    expect(el.scrollTop).toBe(1600);
    expect(isChatNearBottom(el)).toBe(true);
  });
});
