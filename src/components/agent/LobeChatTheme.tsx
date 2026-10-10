import {ConfigProvider, ThemeProvider,} from "@lobehub/ui";
import * as m from "motion/react-m";
import type {ReactNode} from "react";
import "@/components/agent/agentChat.css";

// AntD derives color ramps from its seed, so use concrete colors matching the
// application surface tokens here; scoped CSS consumes the shared variables.
const CHAT_SURFACE = "#151515";
const CHAT_PRIMARY = "#f5f5f5";

/**
 * Scopes @lobehub/ui + antd theme to the Agent chat tree only.
 * Canvas inherits the shared StudioShell content surface.
 * Do not import antd/dist/reset.css here — it mutates html/body globally
 * and would leak into studio pages after visiting /agent.
 */
export function LobeChatTheme({children}: { children: ReactNode }) {
    return (
        <div
            className="agent-chat-root"
            data-agent-chat=""
            style={{
                height: "100%",
                minHeight: "100%",
                background: "transparent",
                color: "var(--foreground)",
                position: "relative",
                zIndex: 1,
            }}
        >
            <ConfigProvider motion={m}>
                <ThemeProvider
                    appearance="dark"
                    defaultAppearance="dark"
                    defaultThemeMode="dark"
                    themeMode="dark"
                    theme={{
                        cssVar: {key: "agent-chat"},
                        token: {
                            colorPrimary: CHAT_PRIMARY,
                            colorInfo: "#60b1ff",
                            colorBgLayout: "transparent",
                            colorBgContainer: CHAT_SURFACE,
                            colorBgElevated: "#202020",
                            colorText: "#f5f5f5",
                            colorTextSecondary: "#9e9e9e",
                            colorBorder: "rgba(255,255,255,0.1)",
                            fontFamily: "var(--font-sans)",
                            fontSize: 14,
                            lineHeight: 22 / 14,
                            controlHeight: 36,
                            controlHeightSM: 32,
                            borderRadius: 10,
                            borderRadiusLG: 12,
                        },
                    }}
                    style={{
                        height: "100%",
                        minHeight: "100%",
                        background: "transparent",
                    }}
                >
                    {children}
                </ThemeProvider>
            </ConfigProvider>
        </div>
    );
}
