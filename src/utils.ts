export interface StravaAuthResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  token_type: string;
}

export function getUpstreamAuthorizeUrl(params: {
  upstream_url: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string;
}) {
  const url = new URL(params.upstream_url);
  url.searchParams.set("client_id", params.client_id);
  url.searchParams.set("redirect_uri", params.redirect_uri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", params.scope);
  url.searchParams.set("state", params.state);
  return url.toString();
}

export async function fetchUpstreamAuthToken(params: {
  upstream_url: string;
  client_id: string;
  client_secret: string;
  code: string | null;
  redirect_uri: string;
}): Promise<[StravaAuthResponse, null] | [null, Response]> {
  if (!params.code) {
    return [null, new Response("No code provided", { status: 400 })];
  }

  const response = await fetch(params.upstream_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: params.client_id,
      client_secret: params.client_secret,
      code: params.code,
      grant_type: "authorization_code",
      redirect_uri: params.redirect_uri,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    return [null, new Response(`Failed to fetch token: ${error}`, { status: response.status })];
  }

  const data = await response.json() as StravaAuthResponse;
  return [data, null];
}
