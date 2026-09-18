import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Dropdown, Input, Switch, Tooltip } from "antd";
import { ArrowLeft, Boxes, Check, ChevronDown, ChevronRight, Hand, Plus, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/db/database";
import { GENERAL_AGENT_ID, type AgentPermissionMode } from "@/domain/agent";
import { getGeneralAgentConfig, updateGeneralAgentConfig } from "@/db/agentSettings";
import { AGENT_SKILLS } from "@/lib/agent/skills";

const PERMISSIONS = [
  { id: "ask", title: "请求批准", description: "编辑业务数据或使用互联网工具前询问", icon: Hand },
  { id: "assist", title: "帮我批准", description: "常规操作自动执行，高风险操作询问", icon: ShieldCheck },
  { id: "full", title: "完全访问", description: "自主执行已启用工具，不请求批准", icon: ShieldAlert },
] satisfies Array<{ id: AgentPermissionMode; title: string; description: string; icon: typeof Hand }>;

function popupRoot(): HTMLElement {
  return document.querySelector<HTMLElement>(".agent-chat-root") ?? document.body;
}

function useAgentSettings() {
  const config = useLiveQuery(() => db.agents.get(GENERAL_AGENT_ID), []);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  useEffect(() => { void getGeneralAgentConfig().catch(() => toast.error("读取助手配置失败")); }, []);
  const mode = config?.permissionMode ?? "ask";
  const selected = PERMISSIONS.find((item) => item.id === mode) ?? PERMISSIONS[0];
  const PermissionIcon = selected.icon;
  const enabledSkills = config?.enabledSkillIds ?? AGENT_SKILLS.map((skill) => skill.id);

  const save = async (action: () => Promise<void>, success: string) => {
    if (saveLock.current || !config) return;
    saveLock.current = true;
    setSaving(true);
    try {
      await action();
      toast.success(success);
    } catch {
      toast.error("保存助手设置失败，请重试");
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  return { config, saving, save, mode, selected, PermissionIcon, enabledSkills };
}

export function AgentControls() {
  const { config, saving, save, mode, selected, PermissionIcon } = useAgentSettings();
  const [permissionOpen, setPermissionOpen] = useState(false);
  return (
    <>
      <Dropdown
        trigger={["click"]}
        placement="topLeft"
        getPopupContainer={popupRoot}
        open={permissionOpen}
        onOpenChange={(next, info) => { if (info.source === "trigger") setPermissionOpen(next); }}
        autoFocus
        menu={{
          className: "agent-composer-menu",
          selectedKeys: [mode],
          items: PERMISSIONS.map((item) => ({
            key: item.id,
            disabled: saving || !config,
            className: item.id === "full" ? "agent-permission-full" : undefined,
            icon: <item.icon size={18} aria-hidden />,
            label: <span className="agent-control-option"><span>{item.title}{item.id === mode && <Check size={14} aria-hidden />}</span><small>{item.description}</small></span>,
          })),
          onClick: ({ key }) => {
            if (key === mode) { setPermissionOpen(false); return; }
            void save(async () => {
              await updateGeneralAgentConfig({ permissionMode: key as AgentPermissionMode });
              setPermissionOpen(false);
            }, "权限已更新，对新执行生效");
          },
        }}
        popupRender={(menu) => <div className="agent-control-panel">
          <div className="agent-control-panel-heading">助手权限</div>
          {menu}
          <p className="agent-control-panel-note" role="status">{saving ? "正在保存…" : "对新执行生效。普通对话和计划保存无需批准。"}</p>
        </div>}
      >
        <Tooltip title={`权限：${selected.title}`} placement="top" getPopupContainer={popupRoot} trigger={["hover", "focus"]}>
          <button type="button" className={`agent-chip agent-control agent-permission-trigger${mode === "full" ? " agent-permission-full" : ""}`} aria-label={`权限：${selected.title}`} aria-haspopup="menu" aria-expanded={permissionOpen} aria-busy={saving}>
            <PermissionIcon size={16} aria-hidden /><span>{selected.title}</span><ChevronDown size={12} aria-hidden />
          </button>
        </Tooltip>
      </Dropdown>
    </>
  );
}

export function ComposerPlusMenu() {
  const { config, saving, save, enabledSkills } = useAgentSettings();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"home" | "skills">("home");
  const [search, setSearch] = useState("");
  const searchInput = useRef<import("antd").InputRef>(null);
  useEffect(() => { if (open) searchInput.current?.focus(); }, [open, view]);
  const skills = AGENT_SKILLS.filter((skill) => `${skill.name} ${skill.description}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const toggleSkill = (key: string) => void save(async () => {
    const current = await getGeneralAgentConfig();
    const previous = current.enabledSkillIds ?? AGENT_SKILLS.map((skill) => skill.id);
    await updateGeneralAgentConfig({ enabledSkillIds: previous.includes(key) ? previous.filter((id) => id !== key) : [...previous, key] });
  }, "技能已更新，对新执行生效");

  return <Dropdown
    trigger={["click"]}
    placement="topLeft"
    getPopupContainer={popupRoot}
    open={open}
    onOpenChange={(next, info) => {
      if (info.source !== "trigger") return;
      setOpen(next);
      if (next) { setView("home"); setSearch(""); }
    }}
    autoFocus
    menu={{
      className: "agent-composer-menu",
      items: view === "home" ? [
        { key: "skills", icon: <Boxes size={16} />, label: <span className="agent-plus-row">技能<span>{enabledSkills.length} 项已启用<ChevronRight size={14} /></span></span> },
      ] : [],
      onClick: ({ key }) => {
        if (key === "skills") { setView("skills"); return; }
        setOpen(false);
      },
    }}
    popupRender={(menu) => view === "home" ? <div className="agent-control-panel">
      <div className="agent-skill-search"><Input variant="borderless" ref={searchInput} prefix={<Search size={14} />} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索技能与操作…" aria-label="搜索技能与操作" allowClear /></div>
      <div className="agent-control-panel-heading">创作能力</div>
      {search.trim() ? <div className="agent-skill-list">{skills.length ? skills.map((skill) => <button key={skill.id} type="button" className="agent-plus-search-result" onClick={() => setView("skills")}><Boxes size={16} /><span className="agent-control-option"><span>{skill.name}</span><small>{skill.description}</small></span><ChevronRight size={14} /></button>) : <p className="agent-control-panel-note">没有匹配的技能或操作</p>}</div> : menu}
    </div> : <div className="agent-control-panel agent-skill-panel">
      <div className="agent-skill-heading">
        <button type="button" className="agent-skill-back" aria-label="返回更多选项" onClick={() => setView("home")}><ArrowLeft size={16} />技能</button>
        <span>{enabledSkills.length} 项已启用</span>
      </div>
      <div className="agent-skill-search"><Input variant="borderless" ref={searchInput} prefix={<Search size={14} />} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索技能…" aria-label="搜索技能" allowClear /></div>
      <div className="agent-skill-list">
        {skills.length ? skills.map((skill) => <div className="agent-skill-row" key={skill.id}>
          <span className="agent-control-option"><span>{skill.name}</span><small>{skill.description}</small></span>
          <Switch size="small" checked={enabledSkills.includes(skill.id)} disabled={saving || !config} aria-label={skill.name} onChange={() => toggleSkill(skill.id)} />
        </div>) : <p className="agent-control-panel-note">没有匹配的技能</p>}
      </div>
      <p className="agent-control-panel-note" role="status">{saving ? "正在保存…" : "对新执行生效，已开始的执行保留原设置。"}</p>
    </div>}
  >
    <Tooltip title="更多选项" open={open ? false : undefined} placement="top" getPopupContainer={popupRoot} trigger={["hover", "focus"]}>
      <button type="button" className="agent-chip agent-control agent-control-icon" aria-label="更多选项" aria-haspopup="menu" aria-expanded={open}><Plus size={18} aria-hidden /></button>
    </Tooltip>
  </Dropdown>;
}
