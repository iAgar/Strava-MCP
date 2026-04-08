/**
 * Cloudflare Workers instances are not guaranteed to share in-memory state.
 * For now, we treat rate limit awareness as per-request feedback from Strava.
 */

export function updateRateLimitFromHeaders(headers: Headers): void {
  // Strava provides rate limit usage and limit on every response.
  // This function exists so the caller can observe headers if needed.
  const usage = headers.get('x-ratelimit-usage');
  const limit = headers.get('x-ratelimit-limit');

  if (!usage || !limit) {
    return;
  }

  // No shared state is maintained in Workers. We keep this helper for future debugging
  // or telemetry integration without relying on cross-instance counters.
  const [shortUsage, longUsage] = usage.split(',').map(Number);
  const [shortLimit, longLimit] = limit.split(',').map(Number);

  if (Number.isFinite(shortUsage) && Number.isFinite(longUsage) && Number.isFinite(shortLimit) && Number.isFinite(longLimit)) {
    console.debug('Strava rate limit:', {
      shortUsage,
      longUsage,
      shortLimit,
      longLimit,
    });
  }
}
