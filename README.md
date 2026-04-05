# Strava MCP Server

A robust, multi-user Strava integration server built with the [Model Context Protocol (MCP)](https://modelcontextprotocol.io). This project exposes core Strava API features as both standard HTTP tools and MCP-compliant tools, allowing seamlessly interaction with Strava data (activities, athlete profiles, segments, and stats) from any MCP-enabled client.

## Features

- **Multi-user Strava OAuth**: Securely handles Strava authentication and session management.
- **Strict User Isolation**: Every request is scoped to the authenticated athlete via a `session_id`.
- **Automatic Token Refresh**: Transparently manages access token expiration and refreshing.
- **Core Strava Tools**:
    - Athlete Profile (`get_athlete_profile`)
    - Activities (`get_activities`, `get_activity_details`, `create_activity`, `update_activity`)
    - Athlete Stats (`get_athlete_stats`)
    - Segments (`get_segments`, `get_segment_efforts`)
- **MCP Protocol Layer**: Exposes all tools via HTTP (SSE) transport using the `@modelcontextprotocol/sdk`.
- **Type Safety**: Built with TypeScript and Zod for strict input/output validation.

## Prerequisites

- Node.js (v18 or higher)
- A Strava API Application ([Create one here](https://www.strava.com/settings/api))
- A PostgreSQL database (e.g., Neon, RDS, or local)

## Getting Started

### 1. Clone and Install

```bash
cd strava-mcp
npm install
```

### 2. Configure Environment

Create a `.env` file based on `.env.example`:

```env
# Strava API Credentials
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_REDIRECT_URI=http://localhost:3000/auth/callback

# Database Configuration
DATABASE_URL="postgresql://user:password@host:port/dbname?sslmode=require"

# Server Configuration
PORT=3000
```

### 3. Initialize Database

```bash
npx prisma migrate dev --name init
```

### 4. Run the Server

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

## Usage

### Authentication
1. Navigate to `http://localhost:3000/auth/login`.
2. Authorize the application on Strava.
3. You will receive a `session_id` in the callback response.

### Using HTTP Tools
Include your `session_id` in the `x-session-id` header for all tool requests:
```bash
curl -H "x-session-id: YOUR_SESSION_ID" http://localhost:3000/tools/get_athlete_profile
```

### Using MCP (Model Context Protocol)
The MCP server is exposed via SSE at:
- **SSE Entry Point**: `http://localhost:3000/sse`
- **Message Endpoint**: `http://localhost:3000/messages`

Every MCP tool call must include a `sessionId` in its arguments to ensure user-specific data access.

## Tech Stack

- **Backend**: Node.js, Express
- **Database**: PostgreSQL with Prisma ORM
- **Protocol**: Model Context Protocol (MCP)
- **Validation**: Zod
- **API Client**: Axios

## License
ISC