import {GITHUB_URL, LOGO_SRC} from "@/lib/brand";

const RELEASES_URL = `${GITHUB_URL}/releases`;
const LICENSE_URL = `${GITHUB_URL}/blob/main/LICENSE`;

// Every claim here has a README/code basis; see the task research (section 3).
const FEATURES: ReadonlyArray<{title: string; body: string}> = [
    {title: "本机优先", body: "桌面版把数据放在本机 SQLite，浏览器版放在 IndexedDB，不需要服务端应用数据库。AI 与联网研究仍然需要联网。"},
    {title: "自带密钥", body: "可连接 OpenAI 兼容服务、DeepSeek、APIMart、AIHubMix、MiMo 等供应商。密钥保存在本机，请求直接发给你配置的供应商；小光点本身不提供模型服务。"},
    {title: "从故事到分镜", body: "视频项目覆盖单片与剧集、世界设定、故事与场次、镜头表和资产关联，可导出分集 CSV、可打印分镜板与项目 ZIP。"},
    {title: "创作助手", body: "流式对话、任务计划与三档权限；执行过程可回看，成果以工作台中实际保存的内容为准。"},
    {title: "视频、音频与音乐", body: "同一应用内的三类项目：影视分镜、多轨音频（支持 WAV 导出）、音乐生成与作品库。"},
    {title: "IP 与素材库", body: "多 IP 档案与三级素材库；项目采用素材时会创建副本并记录版本。"},
];

// Keep the markup in sync with the static copy inside #root of landing.html
// (tests/landingEntry.test.ts compares them).
export function Landing() {
    return (
        <div className="lp">
            <a className="lp-skip" href="#main">跳到正文</a>
            <header className="lp-header">
                <a className="lp-brand" href="/"><img src={LOGO_SRC} alt="" width={28} height={28} /><span>小光点</span></a>
                <nav aria-label="主要"><a className="lp-btn lp-btn-quiet" href="/agent" data-umami-event="enter-app">进入应用</a></nav>
            </header>
            <main id="main">
                <section className="lp-hero" aria-labelledby="lp-title">
                    <p className="lp-eyebrow">本地优先 · 开源 MIT</p>
                    <h1 id="lp-title">小光点 Cuepoint</h1>
                    <p className="lp-lead">本地优先的 AI 创作工作室，让故事、画面、声音和音乐在同一个项目中逐步成形。</p>
                    <div className="lp-actions">
                        <a className="lp-btn lp-btn-primary" href="/agent" data-umami-event="try-online">在浏览器中体验</a>
                        <a className="lp-btn" href={RELEASES_URL} rel="noopener noreferrer" data-umami-event="download">下载桌面版</a>
                        <a className="lp-btn" href={GITHUB_URL} rel="noopener noreferrer" data-umami-event="github">GitHub</a>
                    </div>
                    <p className="lp-note">桌面版目前为测试版，未签名，首次打开可能出现系统安全提示。项目数据保存在当前浏览器或本机；使用 AI 功能需要自备模型服务的 API Key。</p>
                </section>
                <section className="lp-section" aria-labelledby="lp-features">
                    <h2 id="lp-features">能做什么</h2>
                    <ul className="lp-grid">
                        {FEATURES.map(item => (
                            <li key={item.title}><h3>{item.title}</h3><p>{item.body}</p></li>
                        ))}
                    </ul>
                </section>
            </main>
            <footer className="lp-footer">
                <p>项目数据只保存在你的浏览器或本机，不会上传到小光点的服务器；AI 请求直接发往你配置的供应商。浏览器版与桌面版的数据相互独立，请定期导出项目 ZIP。本页会加载 Google Fonts，站点可能启用 Umami 访问统计。</p>
                <p className="lp-links">
                    <a href={GITHUB_URL} rel="noopener noreferrer">GitHub</a>
                    <a href={LICENSE_URL} rel="noopener noreferrer">MIT 协议</a>
                    <a href="/agent">进入应用</a>
                </p>
            </footer>
        </div>
    );
}
