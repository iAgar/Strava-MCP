// worker-configuration.d.ts
interface Env {
	STRAVA_CLIENT_ID: string;
	STRAVA_CLIENT_SECRET: string;
	AUTH_CALLBACK_DOMAIN: string;
	OAUTH_KV: KVNamespace;
	MCP_OBJECT: DurableObjectNamespace;
	OAUTH_PROVIDER: any; // OAuthHelpers
}