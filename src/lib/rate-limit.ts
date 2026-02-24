const AI_RATE_LIMIT = 3;
const AI_RATE_WINDOW_MS = 60_000;

const userTimestamps = new Map<string, number[]>();

export function checkAIRateLimit(
  userId: string,
  userBypassCode?: string | null
): { allowed: boolean; retryAfterMs?: number } {
  if (isRateLimitBypassed(userBypassCode ?? null)) {
    return { allowed: true };
  }

  const now = Date.now();
  const timestamps = userTimestamps.get(userId) ?? [];

  // Filter out timestamps older than the window
  const recent = timestamps.filter((t) => now - t < AI_RATE_WINDOW_MS);

  if (recent.length >= AI_RATE_LIMIT) {
    const oldest = recent[0];
    const retryAfterMs = AI_RATE_WINDOW_MS - (now - oldest);
    userTimestamps.set(userId, recent);
    return { allowed: false, retryAfterMs };
  }

  recent.push(now);
  userTimestamps.set(userId, recent);
  return { allowed: true };
}

export function isRateLimitBypassed(userBypassCode: string | null): boolean {
  const validCode = process.env.SIMMR_BYPASS_CODE;
  if (!validCode) return false;
  if (!userBypassCode) return false;
  return userBypassCode === validCode;
}

export function enforceAIRateLimitForUser(user: {
  id: string;
  bypassCode?: string | null;
}): void {
  const result = checkAIRateLimit(user.id, user.bypassCode ?? null);
  if (!result.allowed) {
    throw new Error(
      `You're generating too fast! Please wait ${Math.ceil((result.retryAfterMs ?? 0) / 1000)} seconds before trying again.`
    );
  }
}
