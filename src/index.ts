import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type Props, refreshStravaToken, StravaHandler } from "./strava-handler";
import { StravaClient } from "./strava-api";

// Env definition for convenience
type Env = {
	STRAVA_CLIENT_ID: string;
	STRAVA_CLIENT_SECRET: string;
	AUTH_CALLBACK_DOMAIN: string;
	OAUTH_KV: KVNamespace;
	OAUTH_PROVIDER: any; // OAuthHelpers
};

export class StravaMCP extends McpAgent<unknown, unknown, Props> {
	// Re-initialize McpServer (agents/mcp handle registration via this.server)
	server = new McpServer({
		name: "Strava",
		version: "1.0.0",
	});

	async init() {
		const client = new StravaClient(this.props.accessToken);

		// 1. get_athlete_profile
		this.server.tool(
			"get_athlete_profile",
			"Retrieve the authenticated athlete's profile",
			{},
			async () => {
				const result = await client.stravaRequest<any>('GET', '/athlete');
				if (result.error) return { content: [{ type: "text", text: result.error }], isError: true };
				
				const { id, username, firstname, lastname, city, country, sex, ftp, weight, bikes, shoes } = result.data;
				return { content: [{ type: "text", text: JSON.stringify({ id, username, firstname, lastname, city, country, sex, ftp, weight, bikes, shoes }) }] };
			}
		);

		// 2. get_activities
		this.server.tool(
			"get_activities",
			"List athlete activities with optional filtering",
			{
				after: z.string().optional().describe("ISO date string for filtering activities after this date"),
				before: z.string().optional().describe("ISO date string for filtering activities before this date"),
				page: z.string().optional().describe("Page number"),
				per_page: z.string().optional().describe("Number of items per page"),
				type: z.string().optional().describe("Activity type (e.g., Run, Ride)"),
			},
			async ({ after, before, page, per_page, type }) => {
				const params: any = {};
				if (after) params.after = Math.floor(new Date(after).getTime() / 1000);
				if (before) params.before = Math.floor(new Date(before).getTime() / 1000);
				if (page) params.page = page;
				if (per_page) params.per_page = per_page;

				const result = await client.stravaRequest<any[]>('GET', '/athlete/activities', params);
				if (result.error) return { content: [{ type: "text", text: result.error }], isError: true };

				let activities = result.data!.map((a: any) => ({
					id: a.id,
					name: a.name,
					type: a.type,
					distance: a.distance,
					moving_time: a.moving_time,
					elapsed_time: a.elapsed_time,
					elevation: a.total_elevation_gain,
					start_date: a.start_date,
					average_speed: a.average_speed,
					average_heartrate: a.average_heartrate,
					max_heartrate: a.max_heartrate,
					suffer_score: a.suffer_score,
					average_cadence: a.average_cadence,
				}));

				if (type) {
					activities = activities.filter((a: any) => a.type.toLowerCase() === type.toLowerCase());
				}

				return { content: [{ type: "text", text: JSON.stringify(activities) }] };
			}
		);

		// 3. get_activity_details
		this.server.tool(
			"get_activity_details",
			"Retrieve detailed information about a specific activity",
			{
				id: z.string().describe("The ID of the activity to retrieve details for"),
			},
			async ({ id }) => {
				const result = await client.stravaRequest<any>('GET', `/activities/${id}`);
				if (result.error) return { content: [{ type: "text", text: result.error }], isError: true };

				const a = result.data;
				return {
					content: [{ 
						type: "text", 
						text: JSON.stringify({
							id: a.id,
							name: a.name,
							type: a.type,
							distance: a.distance,
							moving_time: a.moving_time,
							elapsed_time: a.elapsed_time,
							elevation: a.total_elevation_gain,
							start_date: a.start_date,
							splits_metric: a.splits_metric,
							segment_efforts: a.segment_efforts,
							average_heartrate: a.average_heartrate,
							max_heartrate: a.max_heartrate,
							laps: a.laps,
							best_efforts: a.best_efforts,
							calories: a.calories,
							average_speed: a.average_speed,
							average_cadence: a.average_cadence,
							description: a.description,
							gear: a.gear ? { id: a.gear.id, name: a.gear.name } : null,
							kudos_count: a.kudos_count,
							comment_count: a.comment_count,
							map: a.map ? { summary_polyline: a.map.summary_polyline } : null,
						}) 
					}]
				};
			}
		);

		// 4. create_activity
		this.server.tool(
			"create_activity",
			"Create a new manual activity on Strava",
			{
				name: z.string().describe("The name of the activity"),
				type: z.string().describe("The type of activity (e.g., Run, Ride)"),
				distance: z.number().describe("Distance in meters"),
				moving_time: z.number().describe("Moving time in seconds"),
				start_date_local: z.string().describe("ISO date string (local time)"),
				description: z.string().optional().describe("Optional description"),
			},
			async ({ moving_time, ...rest }) => {
				const stravaData = { ...rest, moving_time, elapsed_time: moving_time };
				const result = await client.stravaRequest<any>('POST', '/activities', {}, stravaData);
				if (result.error) return { content: [{ type: "text", text: result.error }], isError: true };
				return { content: [{ type: "text", text: JSON.stringify({ id: result.data.id, name: result.data.name }) }] };
			}
		);

		// 5. update_activity
		this.server.tool(
			"update_activity",
			"Update an existing activity's details",
			{
				id: z.string().describe("The ID of the activity to update"),
				name: z.string().optional().describe("Updated name"),
				type: z.string().optional().describe("Updated type"),
				description: z.string().optional().describe("Updated description"),
				gear_id: z.string().optional().describe("Updated gear ID"),
			},
			async ({ id, type, ...rest }) => {
				const stravaData: any = { ...rest };
				if (type) stravaData.sport_type = type;
				
				const result = await client.stravaRequest<any>('PUT', `/activities/${id}`, {}, stravaData);
				if (result.error) return { content: [{ type: "text", text: result.error }], isError: true };

				const updatedFields: any = {};
				if (rest.name) updatedFields.name = result.data.name;
				if (type) updatedFields.type = result.data.type || result.data.sport_type;
				if (rest.description) updatedFields.description = result.data.description;
				if (rest.gear_id) updatedFields.gear_id = result.data.gear_id;

				return { content: [{ type: "text", text: JSON.stringify(updatedFields) }] };
			}
		);

		// 6. get_athlete_stats
		this.server.tool(
			"get_athlete_stats",
			"Retrieve statistics for the authenticated athlete",
			{},
			async () => {
				const result = await client.stravaRequest<any>('GET', `/athletes/${this.props.userId}/stats`);
				if (result.error) return { content: [{ type: "text", text: result.error }], isError: true };

				const s = result.data;
				return {
					content: [{ 
						type: "text", 
						text: JSON.stringify({
							ytd_run_totals: s.ytd_run_totals,
							ytd_ride_totals: s.ytd_ride_totals,
							ytd_swim_totals: s.ytd_swim_totals,
							all_run_totals: s.all_run_totals,
							all_ride_totals: s.all_ride_totals,
							all_swim_totals: s.all_swim_totals,
						}) 
					}]
				};
			}
		);

		// 7. get_segments
		this.server.tool(
			"get_segments",
			"Explore segments near a specific location with optional radius and activity type filtering",
			{
				lat: z.number().describe("Latitude"),
				lng: z.number().describe("Longitude"),
				radius: z.number().optional().describe("Search radius in km (default 1, max 10)"),
				activity_type: z.string().optional().describe("Activity type: 'riding' or 'running'"),
			},
			async ({ lat, lng, radius = 1, activity_type }) => {
				const offset = radius * 0.009;
				const bounds = `${lat - offset},${lng - offset},${lat + offset},${lng + offset}`;
				const params: any = { bounds };
				if (activity_type) params.activity_type = activity_type;

				const result = await client.stravaRequest<any>('GET', '/segments/explore', params);
				if (result.error) return { content: [{ type: "text", text: result.error }], isError: true };

				const segments = result.data.segments.map((s: any) => ({
					id: s.id,
					name: s.name,
					distance: s.distance,
					avg_grade: s.avg_grade,
					climb_category: s.climb_category,
					city: s.city,
				}));

				return { content: [{ type: "text", text: JSON.stringify(segments) }] };
			}
		);

		// 8. get_segment_efforts
		this.server.tool(
			"get_segment_efforts",
			"Retrieve all efforts for a specific segment",
			{
				id: z.string().describe("The ID of the segment"),
			},
			async ({ id }) => {
				const result = await client.stravaRequest<any[]>('GET', `/segments/${id}/all_efforts`, { 
					athlete_id: parseInt(this.props.userId, 10),
					per_page: 50 
				});
				if (result.error) return { content: [{ type: "text", text: result.error }], isError: true };

				const efforts = result.data!.map((e: any) => ({
					id: e.id,
					elapsed_time: e.elapsed_time,
					moving_time: e.moving_time,
					start_date: e.start_date,
					average_speed: e.average_speed,
				}));

				return { content: [{ type: "text", text: JSON.stringify(efforts) }] };
			}
		);
	}
}

const provider = new OAuthProvider({
	apiRoute: "/mcp", 
	apiHandler: StravaMCP.mount("/mcp"),
	defaultHandler: StravaHandler,
	authorizeEndpoint: "/authorize",
	tokenEndpoint: "/token",
	clientRegistrationEndpoint: "/register",
	tokenExchangeCallback: async (options) => {
		if (options.grantType === "refresh_token") {
			const updatedTokens = await refreshStravaToken(options.props.refreshToken, (options as any).env);
			return { ...options.props, ...updatedTokens };
		}
		return options.props;
	}
});

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		
		// Legacy SSE support
		if (url.pathname === "/sse") {
			return StravaMCP.mount("/sse")(request, env, ctx);
		}

		// Main MCP (Streamable HTTP) and Auth flow
		return provider.fetch(request, env, ctx);
	}
};
