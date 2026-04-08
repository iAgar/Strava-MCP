import { updateRateLimitFromHeaders } from './lib/rateLimiter';

export class StravaClient {
  private baseUrl = 'https://www.strava.com/api/v3';
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private buildQueryString(params?: Record<string, any>): string {
    if (!params) return '';
    const queryParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });

    const queryString = queryParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  public async stravaRequest<T>(method: string, path: string, params?: Record<string, any>, data?: any): Promise<{ data?: T; error?: string; status: number }> {
    const url = `${this.baseUrl}${path}${this.buildQueryString(params)}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
      });

      updateRateLimitFromHeaders(response.headers);

      if (!response.ok) {
        if (response.status === 429) {
          return { error: 'Strava API rate limit reached. Please wait before trying again.', status: 429 };
        }

        const errorData: any = await response.json().catch(() => ({}));
        return { error: errorData.message || response.statusText, status: response.status };
      }

      const responseData = await response.json() as T;
      return { data: responseData, status: response.status };
    } catch (error: any) {
      return { error: error?.message ?? 'Unknown error', status: 500 };
    }
  }

  async getLoggedInAthlete() {
    return this.stravaRequest<any>('GET', '/athlete');
  }

  async listAthleteActivities(params?: {
    after?: number;
    before?: number;
    page?: string;
    per_page?: string | number;
  }) {
    return this.stravaRequest<any[]>('GET', '/athlete/activities', params);
  }

  async getActivity(id: string) {
    return this.stravaRequest<any>('GET', `/activities/${id}`);
  }

  async createActivity(params: any) {
    return this.stravaRequest<any>('POST', '/activities', undefined, params);
  }

  async updateActivity(id: string, params: any) {
    return this.stravaRequest<any>('PUT', `/activities/${id}`, undefined, params);
  }

  async getAthleteStats(athleteId: string) {
    return this.stravaRequest<any>('GET', `/athletes/${athleteId}/stats`);
  }

  async exploreSegments(params: any) {
    return this.stravaRequest<any>('GET', '/segments/explore', params);
  }

  async getSegmentEfforts(segmentId: string, athleteId: number) {
    return this.stravaRequest<any[]>('GET', `/segments/${segmentId}/all_efforts`, {
      athlete_id: athleteId,
      per_page: 50,
    });
  }
}
