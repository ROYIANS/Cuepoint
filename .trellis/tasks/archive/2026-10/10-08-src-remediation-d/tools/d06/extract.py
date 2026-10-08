from pathlib import Path
output=Path('src/domain/output.ts').read_text();profiles=Path('src/lib/agent/generationProfiles.ts').read_text()
facts=output[output.index('export const IMAGE_RATIOS'):output.index('// Strings deliberately')]
advert=profiles[profiles.index('export const GENERATION_PROFILES ='):].replace('export const GENERATION_PROFILES =','export const GENERATION_CAPABILITIES =')
Path('src/domain/generationCapabilities.ts').write_text('/** Verified scalar policies. No credentials, transport, persistence or proposal repair. */\n'+facts+'\n'+advert+'\n')
Path('src/domain/output.ts').write_text(output[:output.index('export const IMAGE_RATIOS')]+'''import {
    apimartImageSizes, defaultImageParameters, defaultVideoParameters,
    getGenerationCapability, isApimartImageModel, validateGenerationParameters,
    type ApimartImageModel,
} from "./generationCapabilities";
export {
    IMAGE_RATIOS, IMAGE_EXT_RATIOS, VIDEO_RATIOS, IMAGE_RESOLUTIONS,
    IMAGE_QUALITIES, IMAGE_EXT_VERSIONS, VIDEO_RESOLUTIONS, APIMART_IMAGE_MODELS,
    isApimartImageModel, isApimartImage25, isApimartImageExt, apimartImageSizes,
    type ApimartImageModel,
} from "./generationCapabilities";

'''+output[output.index('// Strings deliberately'):])
Path('src/lib/agent/generationProfiles.ts').write_text(profiles[:profiles.index('export const GENERATION_PROFILES =')]+'''// Compatibility export: the ordered advertisement is owned by the capability leaf.
export {GENERATION_CAPABILITIES as GENERATION_PROFILES} from "@/domain/generationCapabilities";
''')
