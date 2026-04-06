import { checkRateLimit, recordRequest, updateRateLimitFromHeaders } from './lib/rateLimiter';

export class StravaClient {
  private baseUrl = 'https://www.strava.com/api/v3';
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Helper for Strava API calls with integrated rate limiting and header syncing.
   * Ported from the original Express routes logic.
   */
  public async stravaRequest<T>(method: string, path: string, params?: any, data?: any): Promise<{ data?: T; error?: string; status: number }> {
    // Pre-emptive local check
    const limitCheck = checkRateLimit();
    if (!limitCheck.allowed) {
      const minutes = Math.ceil(limitCheck.retryAfterSeconds! / 60);
      return { 
        error: `Strava API rate limit reached. Try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`, 
        status: 429 
      };
    }

    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) url.searchParams.append(key, String(value));
      });
    }

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
      });
      
      // Increment local counters and sync with headers
      recordRequest();
      updateRateLimitFromHeaders(response.headers);
      
      if (!response.ok) {
        if (response.status === 429) {
          return { error: "Strava API rate limit reached (remote). Please wait before trying again.", status: 429 };
        }
        const errorData: any = await response.json().catch(() => ({}));
        return { error: errorData.message || response.statusText, status: response.status };
      }

      const responseData = await response.json() as T;
      return { data: responseData, status: response.status };
    } catch (error: any) {
      return { error: error.message, status: 500 };
    }
  }

  // Common high-level methods used during the OAuth flow
  async getLoggedInAthlete() {
    const result = await this.stravaRequest<any>('GET', '/athlete');
    if (result.error) throw new Error(result.error);
    return result.data;
  }
}
