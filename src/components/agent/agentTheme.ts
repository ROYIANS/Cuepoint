/**
 * Agent adapters use the shared application palette. Conversation geometry
 * remains local because transcript and composer owners depend on these values.
 */


export const SURFACE_ELEVATED = "var(--surface-elevated)";


export const TEXT = "var(--foreground)";

export const TEXT_TERTIARY = "var(--muted-foreground)";


/** 4px spacing scale from LobeHub DESIGN.md — round off-scale values here. */


/** LobeHub Conversation chrome — ChatHeader is `position: absolute; height: 52px`. */
export const CHAT_HEADER_HEIGHT = 52;
export const SIDEBAR_WIDTH = 260;
export const SIDEBAR_COLLAPSED_WIDTH = 52;
export const CHAT_SAFE_X = 16;
export const CHAT_COMPOSER_SAFE = 168;
export const CHAT_CONTENT_MAX = 800;
export const SIDEBAR_COLLAPSED_KEY = "cuepoint.agent.topicSidebarCollapsed";
