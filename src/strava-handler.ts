import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import { fetchUpstreamAuthToken, getUpstreamAuthorizeUrl, StravaAuthResponse } from "./utils";
import { StravaClient } from "./strava-api";

// We'll define Env locally or import it if generated
type Env = {
	STRAVA_CLIENT_ID: string;
	STRAVA_CLIENT_SECRET: string;
	AUTH_CALLBACK_DOMAIN: string;
	OAUTH_KV: KVNamespace;
	OAUTH_PROVIDER: OAuthHelpers;
};

const app = new Hono<{ Bindings: Env }>();

// Context from the auth process, encrypted & stored in the auth token
// and provided to the StravaMCP as this.props
export type Props = {
	userId: string;
	firstName: string;
	lastName: string;
	accessToken: string;
	refreshToken: string;
};

/**
 * OAuth Authorization Endpoint
 */
app.get("/authorize", async (c) => {
	const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
	if (!oauthReqInfo.clientId) {
		return c.text("Invalid request", 400);
	}

	const callbackUrl = new URL("/callback", c.env.AUTH_CALLBACK_DOMAIN || c.req.url);
	
	return Response.redirect(
		getUpstreamAuthorizeUrl({
			upstream_url: "https://www.strava.com/api/v3/oauth/authorize",
			scope: "read,read_all,profile:read_all,profile:write,activity:read,activity:read_all,activity:write",
			client_id: c.env.STRAVA_CLIENT_ID,
			redirect_uri: callbackUrl.href,
			state: btoa(JSON.stringify(oauthReqInfo)),
		}),
	);
});

/**
 * OAuth Callback Endpoint
 */
app.get("/callback", async (c) => {
	const state = c.req.query("state");
	if (!state) return c.text("Missing state", 400);

	const oauthReqInfo = JSON.parse(atob(state)) as AuthRequest;
	if (!oauthReqInfo.clientId) {
		return c.text("Invalid state", 400);
	}

	const callbackUrl = new URL("/callback", c.env.AUTH_CALLBACK_DOMAIN || c.req.url);

	// Exchange the code for an access token
	const [authResponse, errResponse] = await fetchUpstreamAuthToken({
		upstream_url: "https://www.strava.com/api/v3/oauth/token",
		client_id: c.env.STRAVA_CLIENT_ID,
		client_secret: c.env.STRAVA_CLIENT_SECRET,
		code: c.req.query("code") || null,
		redirect_uri: callbackUrl.href,
	});
	if (errResponse) return errResponse;

	// Fetch user info to populate props
	const stravaClient = new StravaClient(authResponse!.access_token);
	const { data: athlete, error: athleteError } = await stravaClient.getLoggedInAthlete();
	if (athleteError || !athlete) {
		return new Response("Failed to fetch athlete profile from Strava", { status: 502 });
	}

	// Complete authorization and redirect back to client
	const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
		request: oauthReqInfo,
		userId: athlete.id.toString(),
		metadata: {
			label: `${athlete.firstname} ${athlete.lastname}`,
		},
		scope: oauthReqInfo.scope,
		props: {
			userId: athlete.id.toString(),
			firstName: athlete.firstname,
			lastName: athlete.lastname,
			accessToken: authResponse!.access_token,
			refreshToken: authResponse!.refresh_token,
		} as Props,
	});

	return Response.redirect(redirectTo);
});

export const StravaHandler = app;

/**
 * Helper to refresh tokens using Strava's API
 */
export const refreshStravaToken = async (refresh_token: string, env: Env): Promise<Partial<Props>> => {
	const response = await fetch("https://www.strava.com/api/v3/oauth/token", {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			client_id: env.STRAVA_CLIENT_ID,
			client_secret: env.STRAVA_CLIENT_SECRET,
			grant_type: 'refresh_token',
			refresh_token,
		}).toString(),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Failed to refresh token: ${response.status} ${errorText}`);
	}

	const authResponse = await response.json() as StravaAuthResponse;
	return {
		accessToken: authResponse.access_token,
		refreshToken: authResponse.refresh_token
	};
};
