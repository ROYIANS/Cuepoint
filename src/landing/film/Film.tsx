import {useEffect, useRef, useState, type CSSProperties, type ReactNode} from "react";
import {GITHUB_URL, LOGO_SRC} from "@/lib/brand";
import {PRIVACY} from "../content/copy";
import {Credits} from "../credits/Credits";
import type {DownloadData} from "../download/useReleases";
import {Hud, Perforations} from "./Hud";
import {useFilmMode} from "./mode";
import {SceneBody} from "./SceneBody";
import {STAGE_SCENES, TOTAL_WEIGHT} from "./scenes";
import {SkipButton} from "./SkipButton";
import {SCENE_FADE, sceneProgressWindow} from "./timeline";
import {useFilmProgress} from "./useFilmProgress";

const LICENSE_URL = `${GITHUB_URL}/blob/main/LICENSE`;
const LAST_STAGE = STAGE_SCENES.length - 1;

// The toggle comes first in the DOM (first Tab stop) and is moved visually by CSS.
function Header({toggle}: {toggle: ReactNode}) {
    return (
        <header className="lp-header">
            <div className="lp-header-inner">
                {toggle}
                <a className="lp-brand" href="/"><img src={LOGO_SRC} alt="" width={28} height={28} /><span>小光点</span></a>
                <nav aria-label="主要"><a className="lp-btn lp-btn-quiet" href="/agent" data-umami-event="enter-app">进入应用</a></nav>
            </div>
        </header>
    );
}

function Footer() {
    return (
        <footer className="lp-footer">
            <div className="lp-wrap">
                <p>{PRIVACY.text}</p>
                <p className="lp-links">
                    <a href={GITHUB_URL} rel="noopener noreferrer">GitHub</a>
                    <a href={LICENSE_URL} rel="noopener noreferrer">MIT 协议</a>
                    <a href="/agent">进入应用</a>
                </p>
            </div>
        </footer>
    );
}

// Readable page: one <section> per scene, plain document flow, no pinned stage.
// Keep its text and links equivalent to the static markup in landing.html
// (tests/landingEntry.test.ts compares them).
function StaticPage({download, skipped, onToggle}: {download: DownloadData; skipped: boolean; onToggle: () => void}) {
    return (
        <div className="lp-page" data-film-mode="static">
            <a className="lp-skip" href="#main">跳到正文</a>
            <Header toggle={skipped ? <SkipButton skipped onToggle={onToggle} /> : null} />
            <main id="main">
                <div className="lp-wrap">
                    {STAGE_SCENES.map(scene => {
                        const hero = scene.id === "leader";
                        return (
                            <section key={scene.id} className={hero ? "lp-scene lp-hero" : "lp-scene"} data-scene={scene.id} aria-labelledby={hero ? "lp-title" : `lp-scene-${scene.id}`}>
                                <SceneBody id={scene.id} heading={hero ? "h1" : "h2"} headingId={hero ? "lp-title" : `lp-scene-${scene.id}`} />
                                {hero ? (
                                    <div className="lp-actions">
                                        <a className="lp-btn lp-btn-primary" href="/agent" data-umami-event="try-online-hero">在浏览器中体验</a>
                                        <a className="lp-btn" href="#download" data-umami-event="download-hero">下载桌面版</a>
                                        <a className="lp-btn" href={GITHUB_URL} rel="noopener noreferrer" data-umami-event="github-hero">GitHub</a>
                                    </div>
                                ) : null}
                            </section>
                        );
                    })}
                    <Credits download={download} />
                </div>
            </main>
            <Footer />
        </div>
    );
}

// Scroll-driven film. Layout: a track `TOTAL_WEIGHT` viewports tall holds a
// sticky 100svh stage; the closing credits follow as normal flow once the stage
// is released. The stage is decorative (aria-hidden); a visually hidden copy of
// the six stage scenes' text provides the reading order for assistive tech, and
// the credits are the one real interactive region. Stage layers other than the
// active scene are `inert`, so nothing hidden can take focus.
function FilmPage({download, onToggle}: {download: DownloadData; onToggle: () => void}) {
    const rootRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const driver = useFilmProgress(rootRef, trackRef);
    const [active, setActive] = useState(0);
    useEffect(() => driver.subscribe(({sceneIndex}) => setActive(sceneIndex)), [driver]);
    const track = {"--film-length": TOTAL_WEIGHT, "--fade": SCENE_FADE} as CSSProperties;
    return (
        <div className="lp-page lp-film" data-film-mode="film" ref={rootRef}>
            <Header toggle={<SkipButton skipped={false} onToggle={onToggle} />} />
            <main id="main">
                <div className="lp-sr-only">
                    {STAGE_SCENES.map(scene => (
                        <section key={scene.id} data-sr-scene={scene.id} aria-labelledby={`lp-sr-${scene.id}`}>
                            <SceneBody id={scene.id} heading={scene.id === "leader" ? "h1" : "h2"} headingId={`lp-sr-${scene.id}`} />
                        </section>
                    ))}
                </div>
                <div className="lp-track" ref={trackRef} style={track}>
                    <div className="lp-stage" aria-hidden="true">
                        <div className="lp-stage-bg" />
                        <canvas className="lp-canvas" data-film-canvas aria-hidden="true" />
                        <Perforations />
                        {STAGE_SCENES.map((scene, index) => {
                            const {start, end} = sceneProgressWindow(index);
                            // The first scene is fully visible at progress 0 and the last at 1.
                            const layerWindow = {"--s": index === 0 ? -SCENE_FADE : start, "--e": index === LAST_STAGE ? 1 + SCENE_FADE : end} as CSSProperties;
                            return (
                                <div key={scene.id} className="lp-layer" data-scene-layer={scene.id} inert={index !== active} style={layerWindow}>
                                    <div className="lp-layer-inner"><SceneBody id={scene.id} heading="p" /></div>
                                </div>
                            );
                        })}
                        <p className="lp-scroll-hint">向下滚动，开始放映</p>
                        <Hud driver={driver} />
                    </div>
                </div>
                <div className="lp-wrap"><Credits download={download} /></div>
            </main>
            <Footer />
        </div>
    );
}

export function Film({download}: {download: DownloadData}) {
    const {mode, skipped, setSkipped} = useFilmMode();
    const toggle = () => {
        setSkipped(!skipped);
        try {
            window.scrollTo(0, 0);
        } catch {
            // scrolling is a nicety only
        }
    };
    return mode === "film" ? <FilmPage download={download} onToggle={toggle} /> : <StaticPage download={download} skipped={skipped} onToggle={toggle} />;
}
