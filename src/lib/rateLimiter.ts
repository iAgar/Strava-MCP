interface RateLimit {
  count: number;
  limit: number;
  windowStart: number;
}

// Strava limits: 100 per 15 min, 1000 per day
let shortTerm: RateLimit = {
  count: 0,
  limit: 100,
  windowStart: Date.now(),
};

let longTerm: RateLimit = {
  count: 0,
  limit: 1000,
  windowStart: getUtcMidnight(),
};

function getUtcMidnight(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function resetIfExpired() {
  const now = Date.now();
  
  // 15-minute window
  if (now - shortTerm.windowStart >= 15 * 60 * 1000) {
    shortTerm.count = 0;
    shortTerm.windowStart = now;
  }

  // Daily window (UTC midnight)
  const currentMidnight = getUtcMidnight();
  if (currentMidnight > longTerm.windowStart) {
    longTerm.count = 0;
    longTerm.windowStart = currentMidnight;
  }
}

export function checkRateLimit(): { allowed: boolean; retryAfterSeconds?: number } {
  resetIfExpired();

  if (shortTerm.count >= shortTerm.limit) {
    const retryAfter = Math.ceil((shortTerm.windowStart + 15 * 60 * 1000 - Date.now()) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(0, retryAfter) };
  }

  if (longTerm.count >= longTerm.limit) {
    const nextMidnight = longTerm.windowStart + 24 * 60 * 60 * 1000;
    const retryAfter = Math.ceil((nextMidnight - Date.now()) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(0, retryAfter) };
  }

  return { allowed: true };
}

export function recordRequest() {
  resetIfExpired();
  shortTerm.count++;
  longTerm.count++;
}

/**
 * Updates local counters from Strava's response headers.
 * Headers format: 
 * X-RateLimit-Limit: 100,1000
 * X-RateLimit-Usage: 5,10
 */
export function updateRateLimitFromHeaders(headers: any) {
  const usage = headers['x-ratelimit-usage'];
  const limit = headers['x-ratelimit-limit'];

  if (usage && limit) {
    const [shortUsage, longUsage] = usage.split(',').map(Number);
    const [shortLimit, longLimit] = limit.split(',').map(Number);

    if (!isNaN(shortUsage)) shortTerm.count = shortUsage;
    if (!isNaN(longUsage)) longTerm.count = longUsage;
    if (!isNaN(shortLimit)) shortTerm.limit = shortLimit;
    if (!isNaN(longLimit)) longTerm.limit = longLimit;
  }
}
