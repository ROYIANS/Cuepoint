export const CHAT_AT_BOTTOM_PX = 300;

/** Distance from the list’s true end (includes padding-bottom / composer safe area). */
export function chatDistanceFromBottom(el: {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
}): number {
  return el.scrollHeight - el.scrollTop - el.clientHeight;
}

export function isChatNearBottom(
  el: { clientHeight: number; scrollHeight: number; scrollTop: number },
  thresholdPx = CHAT_AT_BOTTOM_PX,
): boolean {
  return chatDistanceFromBottom(el) <= thresholdPx;
}

export function snapChatToBottom(el: { scrollHeight: number; scrollTop: number }): void {
  el.scrollTop = el.scrollHeight;
}
