export function deriveChatTitle(content: string): string {
  const trimmed = content.trim().replace(/\s+/g, " ");
  if (!trimmed) return "新话题";
  return trimmed.length > 24 ? `${trimmed.slice(0, 24)}…` : trimmed;
}
