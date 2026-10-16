import {useNavigate} from "@tanstack/react-router";
import {ContextParameters} from "./ContextParameters";
import {createPortal} from "react-dom";
import {type RefObject, useEffect, useRef, useState} from "react";
import {useProductQuery} from "../../../platform/product/queries";
import {Dropdown, Input, Switch, Tooltip, type InputRef} from "antd";
import {
    ArrowLeft,
    BookOpen,
    Boxes,
    Check,
    ChevronDown,
    ChevronRight,
    CircleHelp,
    ExternalLink,
    FolderOpen,
    Hand,
    MessagesSquare,
    Plus,
    Plug,
    ShieldAlert,
    ShieldCheck,
    SlidersHorizontal,
    Sparkles,
    Upload
} from "../../../ui/icons";
import {toast} from "sonner";
import {type AgentPermissionMode, GENERAL_AGENT_ID} from "../models/agent";
import type {AgentInteractionMode} from "./composerTypes";
import {getGeneralAgentConfig, updateGeneralAgentConfig} from "../commands/agentSettings";
import {AGENT_SKILLS} from "../runtime/skills";
import {StorageError} from "../../../platform/storage/errors";
import {useInstalledSkills} from "./useInstalledSkills";
import {useMcpManagement} from "../mcp/ui/management";
import {InstalledSkillMutationNotice} from "./InstalledSkillsPanel";

const PERMISSIONS = [
    {id: "ask", title: "请求批准", icon: Hand},
    {id: "assist", title: "帮我批准", icon: ShieldCheck},
    {id: "full", title: "完全访问", icon: ShieldAlert},
] satisfies Array<{ id: AgentPermissionMode; title: string; icon: typeof Hand }>;

function popupRoot(): HTMLElement {
    return document.querySelector<HTMLElement>(".agent-chat-root") ?? document.body;
}

function useAgentSettings() {
    const config = useProductQuery((db) => db.agents.get(GENERAL_AGENT_ID), []);
    const [saving, setSaving] = useState(false);
    const saveLock = useRef(false);
    useEffect(() => {
        void getGeneralAgentConfig().catch(() => toast.error("读取助手配置失败"));
    }, []);
    const mode = config?.permissionMode ?? "ask";
    const selected = PERMISSIONS.find((item) => item.id === mode) ?? PERMISSIONS[0];
    const PermissionIcon = selected.icon;
    const enabledSkills = config?.enabledSkillIds ?? AGENT_SKILLS.map((skill) => skill.id);

    const save = async (action: () => Promise<void>) => {
        if (saveLock.current || !config) return;
        saveLock.current = true;
        setSaving(true);
        try {
            await action();
        } catch {
            toast.error("保存助手设置失败，请重试");
        } finally {
            saveLock.current = false;
            setSaving(false);
        }
    };

    return {config, saving, save, mode, selected, PermissionIcon, enabledSkills};
}

export function AgentControls() {
    const {config, saving, save, mode, selected, PermissionIcon} = useAgentSettings();
    const [permissionOpen, setPermissionOpen] = useState(false);
    return (
        <>
            <Dropdown
                trigger={["click"]}
                placement="topLeft"
                getPopupContainer={popupRoot}
                open={permissionOpen}
                onOpenChange={(next, info) => {
                    if (info.source === "trigger") setPermissionOpen(next);
                }}
                autoFocus
                menu={{
                    className: "agent-composer-menu",
                    selectedKeys: [mode],
                    items: PERMISSIONS.map((item) => ({
                        key: item.id,
                        disabled: saving || !config,
                        className: item.id === "full" ? "agent-permission-full" : undefined,
                        icon: <item.icon size={18} aria-hidden/>,
                        label: <span className="agent-control-option"><span>{item.title}{item.id === mode &&
                            <Check size={14} aria-hidden/>}</span></span>,
                    })),
                    onClick: ({key}) => {
                        if (key === mode) {
                            setPermissionOpen(false);
                            return;
                        }
                        void save(async () => {
                            await updateGeneralAgentConfig({permissionMode: key as AgentPermissionMode});
                            setPermissionOpen(false);
                        });
                    },
                }}
                popupRender={(menu) => <div className="agent-control-panel">{menu}</div>}
            >
                <Tooltip title={`权限：${selected.title}`} placement="top" getPopupContainer={popupRoot}
                         trigger={["hover", "focus"]}>
                    <button type="button"
                            className={`agent-chip agent-control agent-permission-trigger${mode === "full" ? " agent-permission-full" : ""}`}
                            aria-label={`权限：${selected.title}`} aria-haspopup="menu" aria-expanded={permissionOpen}
                            aria-busy={saving}>
                        <PermissionIcon size={16} aria-hidden/><span>{selected.title}</span><ChevronDown size={12}
                                                                                                         aria-hidden/>
                    </button>
                </Tooltip>
            </Dropdown>
        </>
    );
}

function Hint({text}: {text: string}) {
    return <Tooltip title={text}><button type="button" className="agent-plus-hint" aria-label={text} onClick={event => event.stopPropagation()}><CircleHelp size={13} aria-hidden/></button></Tooltip>;
}

function plusRow(title: string, hint?: string, nested = false) {
    return <span className="agent-plus-row"><span className="agent-plus-copy"><strong>{title}</strong>{hint ? <small>{hint}</small> : null}</span>{nested ? <ChevronRight size={14} aria-hidden/> : null}</span>;
}

function PlusSheetToolbar({onBack, search, onSearch, searchRef, placeholder, manage, onManage}: {
    onBack: () => void;
    search: string;
    onSearch: (value: string) => void;
    searchRef?: RefObject<InputRef | null>;
    placeholder: string;
    manage?: string;
    onManage?: () => void;
}) {
    return <div className="agent-sheet-toolbar">
        <button type="button" className="agent-skill-back" aria-label="返回" onClick={onBack}><ArrowLeft size={16} aria-hidden/></button>
        <div className="agent-skill-search"><Input variant="borderless" ref={searchRef} value={search}
                                                   onChange={event => onSearch(event.target.value)}
                                                   placeholder={placeholder} aria-label={placeholder} allowClear/></div>
        {manage && onManage ? <button type="button" className="agent-sheet-manage" onClick={onManage}>{manage}<ExternalLink size={13} aria-hidden/></button> : null}
    </div>;
}

export function ComposerPlusMenu({threadId, projectId, interactionMode, onInteractionModeChange, onImport, onLibrary, sheetHost, onOpenChange}: {
    threadId?: string;
    projectId?: string;
    interactionMode?: AgentInteractionMode;
    onInteractionModeChange?: (mode: AgentInteractionMode) => void;
    onImport?: () => void;
    onLibrary?: () => void;
    sheetHost?: RefObject<HTMLDivElement | null>;
    onOpenChange?: (open: boolean) => void;
}) {
    const navigate = useNavigate();
    const project = useProductQuery(async (db) => projectId ? (await db.projects.get(projectId)) ?? null : null, [projectId]);
    const openMemory = () => {
        if (projectId && project) {
            setOpen(false);
            void navigate({to: "/p/$projectId/memory", params: {projectId}});
        }
    };
    const {config, enabledSkills: savedBuiltinSkills} = useAgentSettings();
    const installed = useInstalledSkills();
    // Management lives in Settings; the composer only links to it.
    const openSettings = (section: "mcp" | "skills") => {
        setOpen(false);
        void navigate({to: "/settings", search: {section}});
    };
    const [builtinPending, setBuiltinPending] = useState(false);
    const [builtinError, setBuiltinError] = useState<string>();
    const [builtinUnknown, setBuiltinUnknown] = useState(false);
    const [builtinOptimistic, setBuiltinOptimistic] = useState<string[]>();
    const builtinLock = useRef(false);
    const enabledSkills = builtinOptimistic ?? savedBuiltinSkills;
    const saving = builtinPending || builtinUnknown || installed.pending;
    const [open, setOpen] = useState(false);
    const [view, setView] = useState<"home" | "skills" | "parameters" | "mcp">("home");
    const mcp = useMcpManagement();
    const [search, setSearch] = useState("");
    const searchInput = useRef<import("antd").InputRef>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (!open) return;
        const dismiss = (event: PointerEvent) => {
            if (event.target instanceof Node && !panelRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) setOpen(false);
        };
        const escape = (event: KeyboardEvent) => {
            if (triggerRef.current?.closest("[inert]")) return;
            if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
                triggerRef.current?.focus();
            }
        };
        document.addEventListener("pointerdown", dismiss, true);
        document.addEventListener("keydown", escape, true);
        return () => {
            document.removeEventListener("pointerdown", dismiss, true);
            document.removeEventListener("keydown", escape, true);
        };
    }, [open]);
    useEffect(() => {
        onOpenChange?.(open);
    }, [open, onOpenChange]);
    useEffect(() => {
        if (open && !triggerRef.current?.closest("[inert]")) searchInput.current?.focus();
    }, [open, view]);
    const skills = AGENT_SKILLS.filter((skill) => `${skill.name} ${skill.description}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
    const installedMatches = installed.entries.filter(skill => `${skill.metadata.name} ${skill.metadata.description}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
    async function toggleSkill(key: string, wantedEnabled: boolean) {
        if (builtinLock.current || !config) return;
        builtinLock.current = true;
        setBuiltinPending(true);
        setBuiltinError(undefined);
        setBuiltinOptimistic(wantedEnabled ? [...new Set([...enabledSkills, key])] : enabledSkills.filter(id => id !== key));
        let unknown = false;
        try {
            const current = await getGeneralAgentConfig();
            const previous = current.enabledSkillIds ?? AGENT_SKILLS.map(skill => skill.id);
            await updateGeneralAgentConfig({enabledSkillIds: wantedEnabled ? [...new Set([...previous, key])] : previous.filter(id => id !== key)});
        } catch (cause) {
            unknown = cause instanceof StorageError && cause.certainty === "unknown";
            if (unknown) {
                setBuiltinUnknown(true);
                setBuiltinError("内置技能设置的保存结果尚未确认，暂时无法再次修改。请重新加载工作区并核对设置后再操作。");
            } else setBuiltinError("内置技能设置保存失败，请重试");
        } finally {
            setBuiltinPending(false);
            if (!unknown) {builtinLock.current = false; setBuiltinOptimistic(undefined);}
        }
    }

    const toggle = () => {
        setOpen(next => {
            if (!next) {setView("home"); setSearch("");}
            return !next;
        });
    };
    const mcpEntries = (mcp.state.catalogue?.entries ?? []).filter(row => row.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
    const backHome = () => {setView("home"); setSearch("");};
    const panel = <div ref={panelRef} className="agent-composer-sheet agent-plus-sheet">{view === "parameters" ?
            <ContextParameters threadId={threadId} onBack={backHome} search={search} onSearch={setSearch} searchRef={searchInput}/> : view === "mcp" ? <div className="agent-control-panel">
                <PlusSheetToolbar onBack={backHome} search={search} onSearch={setSearch} searchRef={searchInput}
                                  placeholder="搜索 MCP…" manage="管理" onManage={() => openSettings("mcp")}/>
                <div className="agent-skill-list">
                    {mcpEntries.map(row => <div className="agent-skill-row" key={row.serverId}>
                        <span>{row.label}</span>
                        <Switch size="small" checked={row.enabled} disabled={Boolean(mcp.state.pending)} aria-label={row.label}
                                onChange={checked => void mcp.owner?.toggle(row, checked)}/>
                    </div>)}
                    {!mcpEntries.length && <p className="agent-control-panel-note">{mcp.state.error ?? "暂无连接"}</p>}
                </div>
            </div> : view === "home" ? <div className="agent-control-panel">
                <div className="agent-skill-search"><Input variant="borderless" ref={searchInput} value={search}
                                                           onChange={(event) => setSearch(event.target.value)}
                                                           placeholder="搜索技能与操作…" aria-label="搜索技能与操作"
                                                           allowClear/></div>
                {search.trim() ?
                    <div className="agent-skill-list">{/mcp|连接|外部|工具|资源/i.test(search) && <button type="button" className="agent-plus-search-result" onClick={() => {setView("mcp"); void mcp.owner?.refresh();}}><Plug size={14}/>MCP<ChevronRight size={14}/></button>}{/导入|上传|图片|文档|文件|upload|import/i.test(search) &&
                        <button type="button" className="agent-plus-search-result" onClick={() => {
                            setOpen(false);
                            onImport?.();
                        }}><Upload size={16}/>文件</button>}{/资料|项目|文件|library|reference/i.test(search) &&
                        <button type="button" className="agent-plus-search-result" onClick={() => {
                            setOpen(false);
                            onLibrary?.();
                        }}><FolderOpen size={16}/>项目资料</button>}{project && /记忆|项目|memory/i.test(search) &&
                        <button type="button" className="agent-plus-search-result" onClick={openMemory}><BookOpen
                            size={16}/>项目记忆<ChevronRight size={14}/>
                        </button>}{/参数|历史|压缩|context|parameter/i.test(search) &&
                        <button type="button" className="agent-plus-search-result"
                                onClick={() => setView("parameters")}><SlidersHorizontal
                            size={16}/>对话参数<ChevronRight size={14}/></button>}{skills.length ? skills.map((skill) =>
                        <button key={skill.id} type="button" className="agent-plus-search-result"
                                onClick={() => setView("skills")}><Boxes size={16}/><span
                            className="agent-control-option"><span>{skill.name}</span><small>{skill.description}</small></span><ChevronRight
                            size={14}/>
                        </button>) : !installedMatches.length && !/mcp|连接|外部|工具|资源|导入|上传|图片|文档|文件|upload|import|资料|项目|library|reference|参数|历史|压缩|context|parameter/i.test(search) && !(project && /记忆|项目|memory/i.test(search)) ?
                        <p className="agent-control-panel-note">没有匹配的技能或操作</p> : null}
                        {installedMatches.map(skill => <button key={skill.skillId} type="button" className="agent-plus-search-result" onClick={() => setView("skills")}>
                            <Boxes size={16}/><span className="agent-control-option"><span>{skill.metadata.name}</span><small>{skill.metadata.description}</small></span><ChevronRight size={14}/></button>)}
                    </div> : <div className="agent-plus-list" role="menu">{[
                        {key: "mode-smart"}, {key: "mode-conversation"}, {key: "divider"}, {key: "import"}, {key: "library"},
                        ...(project ? [{key: "memory"}] : []), {key: "parameters"}, {key: "skills"}, {key: "mcp"},
                    ].map(item => item.key === "divider" ? <hr key="divider" className="agent-plus-rule"/> : <button key={item.key} type="button" role="menuitem"
                        aria-current={item.key === (interactionMode === "conversation" ? "mode-conversation" : "mode-smart") ? "true" : undefined}
                        onClick={() => {
                            const key = item.key;
                            if (key === "mode-smart" || key === "mode-conversation") {
                                onInteractionModeChange?.(key === "mode-smart" ? "smart" : "conversation");
                                setOpen(false);
                                return;
                            }
                            if (key === "mcp") {setView("mcp"); void mcp.owner?.refresh(); return;}
                            if (key === "import" || key === "library") {
                                setOpen(false);
                                if (key === "import") onImport?.(); else onLibrary?.();
                                return;
                            }
                            if (key === "memory") {openMemory(); return;}
                            if (key === "skills" || key === "parameters") setView(key);
                        }}>{item.key === "mode-smart" ? <><Sparkles size={14} className="agent-plus-tint is-smart"/>{plusRow("智能")}</>
                        : item.key === "mode-conversation" ? <><MessagesSquare size={14} className="agent-plus-tint is-chat"/>{plusRow("对话")}</>
                        : item.key === "import" ? <><Upload size={14}/>{plusRow("文件")}</>
                        : item.key === "library" ? <><FolderOpen size={14}/>{plusRow("项目资料")}</>
                        : item.key === "memory" ? <><BookOpen size={14}/>{plusRow("项目记忆", undefined, true)}</>
                        : item.key === "parameters" ? <><SlidersHorizontal size={14}/>{plusRow("对话参数", undefined, true)}</>
                        : item.key === "skills" ? <><Boxes size={14}/>{plusRow("技能", undefined, true)}</>
                        : <><Plug size={14}/>{plusRow("MCP", undefined, true)}</>}</button>)}</div>}
            </div> : <div className="agent-control-panel agent-skill-panel">
                <PlusSheetToolbar onBack={backHome} search={search} onSearch={setSearch} searchRef={searchInput}
                                  placeholder="搜索技能…" manage="管理" onManage={() => openSettings("skills")}/>
                <div className="agent-skill-list">
                    {skills.map((skill) => <div className="agent-skill-row" key={skill.id}>
                        <span className="agent-plus-copy"><strong>{skill.name}</strong><Hint text={skill.description}/></span>
                        <Switch size="small" checked={enabledSkills.includes(skill.id)} disabled={saving || !config}
                                aria-label={skill.name} onChange={checked => void toggleSkill(skill.id, checked)}/>
                    </div>)}
                    {installedMatches.map(skill => <div className="agent-skill-row" key={skill.skillId}>
                        <span className="agent-plus-copy"><strong>{skill.metadata.name}</strong><Hint text={skill.metadata.description}/></span>
                        <Switch size="small" checked={skill.enabled} disabled={saving || installed.blocked} aria-label={`启用 ${skill.metadata.name}`}
                            onChange={checked => void installed.toggle(skill, checked)}/>
                    </div>)}
                    {!skills.length && !installedMatches.length && <p className="agent-control-panel-note">没有匹配的技能</p>}
                    {builtinError && <p className="agent-control-panel-note" role="alert">{builtinError}</p>}
                    <InstalledSkillMutationNotice controller={installed}/>
                </div>
            </div>}</div>;
    return <>
        {open ? (sheetHost?.current ? createPortal(panel, sheetHost.current) : panel) : null}
        <Tooltip title="更多选项" open={open ? false : undefined} placement="top" getPopupContainer={popupRoot}
                 trigger={["hover", "focus"]}>
            <button ref={triggerRef} type="button" className="agent-chip agent-control agent-control-icon"
                    aria-label="更多选项" aria-haspopup="menu" aria-expanded={open} onClick={toggle}><Plus size={18} aria-hidden/>
            </button>
        </Tooltip>
    </>;
}
