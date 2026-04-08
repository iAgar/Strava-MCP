# Strava MCP Server (Cloudflare Workers)

A Model Context Protocol (MCP) server for Strava, built on Cloudflare Workers with proper MCP OAuth. Users authenticate through Strava using a standard "Connect with Strava" flow instead of copying session IDs manually.

## Features

- **8 Strava Tools**:
  - `get_athlete_profile`: Comprehensive user metadata.
  - `get_activities`: Filterable activity list with enriched fields.
  - `get_activity_details`: Deep dive into specific activities.
  - `create_activity`: Log manual activities.
  - `update_activity`: Edit existing activities.
  - `get_athlete_stats`: All-time and YTD totals, including swim totals.
  - `get_segments`: Explore nearby segments with radius and activity-type filtering.
  - `get_segment_efforts`: View athlete efforts on a segment.
- **Enriched Payloads**: Converts Strava API responses into LLM-friendly objects with extra fields like `average_speed`, `average_heartrate`, `suffer_score`, and more.
- **Automatic Auth**: MCP OAuth integration lets clients obtain an auth token through Strava without manual credential exchange.
- **Rate Limiting**: Respects Strava rate limits using response header feedback.
- **Cloudflare Workers**: Runs on Workers with Durable Objects for MCP and KV storage for OAuth state.

## Setup

### 1. Strava API App
1. Go to [Strava Settings -> My App](https://www.strava.com/settings/api).
2. Create an app or update an existing one.
3. Set the **Authorization Callback Domain** to your worker domain (for example `https://your-worker-url.workers.dev` or `http://localhost:8788` during development).

### 2. Cloudflare Configuration
1. Clone this repo.
2. Run `npm install`.
3. Create a KV namespace called `OAUTH_KV`:
   ```bash
   wrangler kv:namespace create "OAUTH_KV"
   ```
4. Copy the returned namespace ID.
5. Update `wrangler.toml` or `wrangler.jsonc` with that `OAUTH_KV` ID.
6. Set Strava credentials in Cloudflare secrets:
   ```bash
   wrangler secret put STRAVA_CLIENT_ID
   wrangler secret put STRAVA_CLIENT_SECRET
   ```

### 3. Local Development
1. Copy the local vars file:
   ```bash
   cp .dev.vars.example .dev.vars
   ```
2. Update `.dev.vars` with your `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, and `AUTH_CALLBACK_DOMAIN`.
3. Run locally:
   ```bash
   npm run dev
   ```

### 4. Deployment
```bash
npm run deploy
```

## Connecting from Claude

Use the worker's Streamable HTTP endpoint in Claude or another MCP-capable client. The connector URL should be:

```text
https://your-worker-url.workers.dev/sse
```

The first time a user interacts with the connector, Strava OAuth will redirect them to log in and authorize access.

## Developer Notes

- `AUTH_CALLBACK_DOMAIN` must be configured for your callback URL.
- `.dev.vars` is used for local dev only and is ignored by Git.
- The project uses `wrangler.jsonc` and Cloudflare Workers-specific bindings for Durable Objects and KV.

## Technical Details

- **Runtime**: Cloudflare Workers
- **Auth**: `@cloudflare/workers-oauth-provider` + MCP OAuth flow
- **State**: Cloudflare KV for OAuth state and session tokens
- **Agent**: `McpAgent` from `agents`
- **Endpoints**: `/sse`, `/authorize`, `/callback`, `/token`, `/register`
