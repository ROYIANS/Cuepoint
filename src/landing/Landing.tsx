import {Film} from "./film/Film";
import {useDownloadData} from "./download/useReleases";

// Standalone page: the scroll-driven film (or its readable static twin) plus the
// download data the closing credits need. The static markup inside #root of
// landing.html must stay equivalent to the static mode of Film.
export function Landing() {
    return <Film download={useDownloadData()} />;
}
