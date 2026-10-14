import {GITHUB_URL} from "@/lib/brand";
import {formatStars} from "./format";

// A quiet closing-credits style prompt. No third-party badge or image: the
// count comes from the GitHub API and is omitted when unavailable.
export function StarPrompt({stars}: {stars?: number}) {
    return (
        <p className="lp-star">
            如果它对你有用，欢迎在 GitHub 点一颗 star。
            <a href={GITHUB_URL} rel="noopener noreferrer" data-umami-event="star">前往 GitHub 点 star</a>
            {stars === undefined ? null : <span className="lp-star-count">（{formatStars(stars)}）</span>}
        </p>
    );
}
