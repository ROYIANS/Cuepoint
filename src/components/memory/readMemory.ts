/** Keep transient storage failures inside the memory view so open drafts stay mounted. */
export async function readMemory<T>(
  read: () => Promise<T>,
): Promise<{ data: T; error?: never } | { data?: never; error: string }> {
  try {
    return { data: await read() };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "读取项目记忆失败",
    };
  }
}
