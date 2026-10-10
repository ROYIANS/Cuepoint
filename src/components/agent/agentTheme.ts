/**
 * Chat-only visual tokens, aligned with LobeHub DESIGN.dark.md names
 * (colorBgLayout / colorTextSecondary / 4px spacing) but scoped to /agent.
 * Studio pages keep Tailwind/shadcn and must not import these.
 */


export const SURFACE_ELEVATED = "#1a1a1a";
export const SURFACE_HOVER = "rgba(255,255,255,0.06)";


export const TEXT = "#ffffff";

export const TEXT_TERTIARY = "#6f6f6f";


/** 4px spacing scale from LobeHub DESIGN.md — round off-scale values here. */


/** LobeHub Conversation chrome — ChatHeader is `position: absolute; height: 52px`. */
export const CHAT_HEADER_HEIGHT = 52;
export const SIDEBAR_WIDTH = 260;
export const SIDEBAR_COLLAPSED_WIDTH = 52;
export const CHAT_SAFE_X = 16;
export const CHAT_COMPOSER_SAFE = 168;
export const CHAT_CONTENT_MAX = 800;
export const SIDEBAR_COLLAPSED_KEY = "cuepoint.agent.topicSidebarCollapsed";
