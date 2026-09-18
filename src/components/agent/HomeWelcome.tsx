import { Avatar, Text } from "@lobehub/ui";
import { SURFACE_HOVER } from "@/components/agent/agentTheme";
import type { ComposerProps } from "@/components/agent/composerTypes";
import { FloatingComposer } from "@/components/agent/FloatingComposer";
import { formatRelative } from "@/components/agent/timeGroups";
import type { ChatThread, Id } from "@/domain/types";
import { LOGO_SRC, PRODUCT_NAME_ZH } from "@/lib/brand";

/**
 * Home welcome — centered greeting + composer, recent topics below.
 */
export function HomeWelcome({
  threads,
  composer,
  onSelectThread,
}: {
  threads: ChatThread[];
  composer: ComposerProps;
  onSelectThread: (id: Id) => void;
}) {
  const recent = threads.slice(0, 8);
  const hour = new Date().getHours();
  const hello =
    hour < 5 ? "夜深了" : hour < 11 ? "早上好" : hour < 14 ? "中午好" : hour < 18 ? "下午好" : "晚上好";

  return (
    <div className="agent-home">
      <div className="agent-home-inner">
        <div className="agent-home-hero">
          <Avatar avatar={LOGO_SRC} background="transparent" shape="square" size={64} />
          <Text
            as="h1"
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            {hello}，欢迎使用 {PRODUCT_NAME_ZH}
          </Text>
          <Text type="secondary" style={{ fontSize: 14, maxWidth: 560, lineHeight: 1.57 }}>
            我是 {PRODUCT_NAME_ZH}。提问、创建内容或启动任务，选好模型后直接发送即可。
          </Text>
        </div>

        <FloatingComposer {...composer} large surface="home" />

        {recent.length > 0 ? (
          <div style={{ marginTop: 24, textAlign: "start" }}>
            <Text type="secondary" style={{ fontSize: 12, paddingInline: 10, paddingBlock: 8 }}>
              最近活动 {recent.length}
            </Text>
            {recent.map((thread) => (
              <div
                key={thread.id}
                onClick={() => onSelectThread(thread.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = SURFACE_HOVER;
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = "transparent";
                }}
              >
                <Avatar avatar={LOGO_SRC} background="transparent" shape="circle" size={22} />
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontSize: 14,
                  }}
                >
                  {thread.title}
                </div>
                <Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>
                  {formatRelative(thread.updatedAt)}
                </Text>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
