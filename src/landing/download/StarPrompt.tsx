import {GITHUB_URL} from "@/lib/brand";
import {formatStars} from "./format";

/** A handful of stars reads as a weakness, so the number appears only from this count on. */
export const STAR_DISPLAY_THRESHOLD = 50;

// A quiet closing-credits style prompt. No third-party badge or image: the
// count comes from the GitHub API and is omitted when unavailable or small.
export function StarPrompt({stars}: {stars?: number}) {
    const showCount = stars !== undefined && stars >= STAR_DISPLAY_THRESHOLD;
    return (
        <p className="lp-star">
            如果它对你有用，欢迎在 GitHub 点一颗 star。
            <a href={GITHUB_URL} rel="noopener noreferrer" data-umami-event="star">前往 GitHub 点 star</a>
            {showCount ? <span className="lp-star-count">（{formatStars(stars)}）</span> : null}
        </p>
    );
}
