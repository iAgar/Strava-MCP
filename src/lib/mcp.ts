import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import axios from "axios";

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

// Create an MCP server
export const mcpServer = new McpServer({
  name: "Strava",
  version: "1.0.0",
});

// Helper to call internal HTTP tools
const callInternalTool = async (path: string, method: string, sessionId: string, params: any = {}, data: any = {}) => {
  try {
    const response = await axios({
      method,
      url: `${BASE_URL}/tools${path}`,
      headers: { "x-session-id": sessionId },
      params,
      data,
    });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(response.data) }],
    };
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.error || error.message;
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ error: message, status }) }],
      isError: true,
    };
  }
};

// Register Tools

// 1. get_athlete_profile
mcpServer.tool(
  "get_athlete_profile",
  "Retrieve the authenticated athlete's profile",
  { sessionId: z.string().describe("Your active session ID") },
  async ({ sessionId }) => callInternalTool("/get_athlete_profile", "GET", sessionId)
);

// 2. get_activities
mcpServer.tool(
  "get_activities",
  "List athlete activities with optional filtering",
  {
    sessionId: z.string().describe("Your active session ID"),
    after: z.string().optional().describe("ISO date string for filtering activities after this date"),
    before: z.string().optional().describe("ISO date string for filtering activities before this date"),
    page: z.string().optional().describe("Page number"),
    per_page: z.string().optional().describe("Number of items per page"),
    type: z.string().optional().describe("Activity type (e.g., Run, Ride)"),
  },
  async ({ sessionId, ...params }) => callInternalTool("/get_activities", "GET", sessionId, params)
);

// 3. get_activity_details
mcpServer.tool(
  "get_activity_details",
  "Retrieve detailed information about a specific activity",
  {
    sessionId: z.string().describe("Your active session ID"),
    id: z.string().describe("The ID of the activity to retrieve details for"),
  },
  async ({ sessionId, id }) => callInternalTool("/get_activity_details", "GET", sessionId, { id })
);

// 4. create_activity
mcpServer.tool(
  "create_activity",
  "Create a new manual activity on Strava",
  {
    sessionId: z.string().describe("Your active session ID"),
    name: z.string().describe("The name of the activity"),
    type: z.string().describe("The type of activity (e.g., Run, Ride)"),
    distance: z.number().describe("Distance in meters"),
    moving_time: z.number().describe("Moving time in seconds"),
    start_date_local: z.string().describe("ISO date string (local time)"),
    description: z.string().optional().describe("Optional description"),
  },
  async ({ sessionId, ...data }) => callInternalTool("/create_activity", "POST", sessionId, {}, data)
);

// 5. update_activity
mcpServer.tool(
  "update_activity",
  "Update an existing activity's details",
  {
    sessionId: z.string().describe("Your active session ID"),
    id: z.string().describe("The ID of the activity to update"),
    name: z.string().optional().describe("Updated name"),
    type: z.string().optional().describe("Updated type"),
    description: z.string().optional().describe("Updated description"),
    gear_id: z.string().optional().describe("Updated gear ID"),
  },
  async ({ sessionId, id, ...data }) => callInternalTool("/update_activity", "PUT", sessionId, { id }, data)
);

// 6. get_athlete_stats
mcpServer.tool(
  "get_athlete_stats",
  "Retrieve statistics for the authenticated athlete",
  { sessionId: z.string().describe("Your active session ID") },
  async ({ sessionId }) => callInternalTool("/get_athlete_stats", "GET", sessionId)
);

// 7. get_segments
mcpServer.tool(
  "get_segments",
  "Explore segments near a specific location with optional radius and activity type filtering",
  {
    sessionId: z.string().describe("Your active session ID"),
    lat: z.number().describe("Latitude"),
    lng: z.number().describe("Longitude"),
    radius: z.number().optional().describe("Search radius in km (default 1, max 10)"),
    activity_type: z.string().optional().describe("Activity type: 'riding' or 'running'"),
  },
  async ({ sessionId, ...params }) => callInternalTool("/get_segments", "GET", sessionId, params)
);

// 8. get_segment_efforts
mcpServer.tool(
  "get_segment_efforts",
  "Retrieve all efforts for a specific segment",
  {
    sessionId: z.string().describe("Your active session ID"),
    id: z.string().describe("The ID of the segment"),
  },
  async ({ sessionId, id }) => callInternalTool("/get_segment_efforts", "GET", sessionId, { id })
);
