/** A leaving route may still render while the router exposes its new pathname. */
export function shouldRedirectAudioMusicChild(kind: string, projectId: string, pathname: string): boolean {
  if (kind !== "audio" && kind !== "music") return false;
  const root = `/p/${projectId}`;
  if (!pathname.startsWith(`${root}/`)) return false;
  return pathname !== `${root}/` && pathname !== `${root}/memory` && pathname !== `${root}/memory/`;
}
