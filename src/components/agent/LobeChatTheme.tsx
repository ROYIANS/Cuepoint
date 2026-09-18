import {
  ConfigProvider,
  ThemeProvider,
} from "@lobehub/ui";
import * as m from "motion/react-m";
import type { ReactNode } from "react";
import "@/components/agent/agentChat.css";

const CHAT_SURFACE = "#0d0d0d";
const CHAT_PRIMARY = "#eeeeee";

/**
 * Scopes @lobehub/ui + antd theme to the Agent chat tree only.
 * Canvas is transparent so StudioField + grain from StudioShell show through.
 * Do not import antd/dist/reset.css here — it mutates html/body globally
 * and would leak into studio pages after visiting /agent.
 */
export function LobeChatTheme({ children }: { children: ReactNode }) {
  return (
    <div
      className="agent-chat-root"
      data-agent-chat=""
      style={{
        height: "100%",
        minHeight: "100vh",
        background: "transparent",
        color: "rgba(255,255,255,0.88)",
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
            cssVar: { key: "agent-chat" },
            token: {
              colorPrimary: CHAT_PRIMARY,
              colorInfo: "#60b1ff",
              colorBgLayout: "transparent",
              colorBgContainer: CHAT_SURFACE,
              colorBgElevated: "#1a1a1a",
              colorText: "#ffffff",
              colorTextSecondary: "#aaaaaa",
              colorBorder: "#202020",
              borderRadius: 8,
              borderRadiusLG: 12,
            },
          }}
          style={{
            height: "100%",
            minHeight: "100vh",
            background: "transparent",
          }}
        >
          {children}
        </ThemeProvider>
      </ConfigProvider>
    </div>
  );
}
