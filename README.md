# Strava MCP Server (Cloudflare Workers)

A Model Context Protocol (MCP) server for Strava, built on Cloudflare Workers. It uses proper MCP OAuth for authentication, allowing clients like Claude to handle login automatically.

## Features

- **8 Strava Tools**:
  - `get_athlete_profile`: Comprehensive user metadata.
  - `get_activities`: Filterable activity list with enriched fields.
  - `get_activity_details`: Deep dive into specific activities (laps, splits, charts).
  - `create_activity`: Log manual activities.
  - `update_activity`: Edit existing activities.
  - `get_athlete_stats`: All-time and YTD totals.
  - `get_segments`: Explore segments with bounding-box logic.
  - `get_segment_efforts`: View personal efforts for a segment.
- **Enriched Payloads**: Data is shaped and calculated (e.g., average speeds, heart rate metrics) before being sent to the LLM.
- **Automatic Auth**: MCP OAuth integration eliminates manual token/session copying.
- **Rate Limiting**: Built-in logic that respects Strava's 100/15min and 1000/day limits.
- **Max Compatibility**: Supports both `/mcp` (Streamable HTTP) and `/sse` (Legacy) endpoints.

## Setup

### 1. Strava API App
1. Go to [Strava Settings -> My App](https://www.strava.com/settings/api).
2. Create an app or update an existing one.
3. Set the **Authorization Callback Domain** to your worker's domain (e.g., `strava-mcp.your-subdomain.workers.dev` or `localhost:8788` for dev).

### 2. Cloudflare Configuration
1. Clone this repo.
2. Run `npm install`.
3. Create a KV namespace in [Cloudflare Dashboard](https://dash.cloudflare.com/) called `OAUTH_KV`.
4. Copy the ID of the new namespace.
5. Update `wrangler.toml` with your `OAUTH_KV` ID.
6. Set your Strava secrets:
   ```bash
   wrangler secret put STRAVA_CLIENT_ID
   wrangler secret put STRAVA_CLIENT_SECRET
   ```

### 3. Local Development
```bash
cp .env.example .dev.vars
# Fill in your IDs in .dev.vars
npm run dev
```

### 4. Deployment
```bash
npm run deploy
```

## connecting to Claude

Add the server to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "strava": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/inspector", "https://your-worker-url.workers.dev/mcp"]
    }
  }
}
```
Or simply use the Streamable HTTP URL in clients that support it. Claude will prompt you to "Log in to Strava" during first use.

## Technical Details

- **Runtime**: Cloudflare Workers
- **Auth**: `workers-oauth-provider` + MCP OAuth Discovery
- **State**: Cloudflare KV for OAuth state and session tokens.
- **Agent**: `McpAgent` via `agents` SDK.