/** Match only browser-playable audio containers; never label unknown bytes as WAV. */
export async function detectAudioMime(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.slice(0, 64).arrayBuffer());
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  const text = (offset: number, value: string) => [...value].every((char, index) => bytes[offset + index] === char.charCodeAt(0));
  if (text(0, "RIFF") && text(8, "WAVE")) return "audio/wav";
  if (text(0, "fLaC")) return "audio/flac";
  if (text(0, "OggS")) return "audio/ogg";
  if (text(0, "ID3")) return "audio/mpeg";
  // ADTS uses a 12-bit sync word and zero layer bits; test before MPEG audio.
  if (bytes.length >= 7 && bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0) return "audio/aac";
  if (bytes.length >= 4 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 && (bytes[1] & 0x18) !== 0x08 && (bytes[1] & 0x06) !== 0 && (bytes[2] & 0xf0) !== 0xf0 && (bytes[2] & 0x0c) !== 0x0c) return "audio/mpeg";
  if (bytes.length >= 12 && text(4, "ftyp")) return "audio/mp4";
  if (starts(0x1a, 0x45, 0xdf, 0xa3)) return "audio/webm";
  const declared = blob.type.toLowerCase().split(";")[0].trim();
  const supported = ["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave", "audio/flac", "audio/x-flac", "audio/ogg", "audio/opus", "audio/mpeg", "audio/mp3", "audio/aac", "audio/mp4", "audio/x-m4a", "audio/webm"];
  // MIME is only a fallback for supported codecs; every caller must also decode.
  if (bytes.length && supported.includes(declared)) return declared;
  throw new Error("无法识别音频文件格式，请使用 WAV、MP3、AAC、FLAC、Ogg、M4A 或 WebM 音频");
}

export function audioMimeExtension(mime: string): string {
  const base = mime.toLowerCase().split(";")[0].trim();
  if (["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"].includes(base)) return "wav";
  if (["audio/flac", "audio/x-flac"].includes(base)) return "flac";
  if (["audio/ogg", "audio/opus"].includes(base)) return "ogg";
  if (["audio/mpeg", "audio/mp3"].includes(base)) return "mp3";
  if (base === "audio/aac") return "aac";
  if (["audio/mp4", "audio/x-m4a"].includes(base)) return "m4a";
  if (base === "audio/webm") return "webm";
  throw new Error("不支持的音频文件格式");
}
