/** Hide credentials before callers truncate provider diagnostics. */
export function redactCredentials(value: string, apiKey: string): string {
  const key = apiKey.trim();
  return (key ? value.split(key).join("[已隐藏]") : value)
    .replace(/Bearer\s+[^\s"',;]+/gi, "Bearer [已隐藏]");
}
