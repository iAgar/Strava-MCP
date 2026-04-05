import { Router, Request, Response } from 'express';
import axios from 'axios';
import { z } from 'zod';

const router = Router();
const STRAVA_BASE_URL = 'https://www.strava.com/api/v3';

// Helper for Strava API calls
const stravaRequest = async (method: string, path: string, token: string, params?: any, data?: any) => {
  try {
    const response = await axios({
      method,
      url: `${STRAVA_BASE_URL}${path}`,
      headers: { Authorization: `Bearer ${token}` },
      params,
      data,
    });
    return { data: response.data, status: response.status };
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || error.message;
    return { error: message, status };
  }
};

// 1. GET /tools/get_athlete_profile
router.get('/get_athlete_profile', async (req: Request, res: Response) => {
  const result = await stravaRequest('GET', '/athlete', req.accessToken!);
  if ('error' in result) return res.status(result.status).json(result);

  const { id, username, firstname, lastname, city, country, sex, ftp, weight, bikes, shoes } = result.data;
  res.json({ id, username, firstname, lastname, city, country, sex, ftp, weight, bikes, shoes });
});

// 2. GET /tools/get_activities
const GetActivitiesSchema = z.object({
  after: z.string().optional(),
  before: z.string().optional(),
  page: z.string().optional(),
  per_page: z.string().optional(),
  type: z.string().optional(),
});

router.get('/get_activities', async (req: Request, res: Response) => {
  const validation = GetActivitiesSchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(400).json({ error: validation.error.issues[0].message, status: 400 });
  }

  const { after, before, page, per_page, type } = validation.data;
  
  // Prep params for Strava
  const params: any = {};
  if (after) params.after = Math.floor(new Date(after).getTime() / 1000);
  if (before) params.before = Math.floor(new Date(before).getTime() / 1000);
  if (page) params.page = page;
  if (per_page) params.per_page = per_page;

  const result = await stravaRequest('GET', '/athlete/activities', req.accessToken!, params);
  if ('error' in result) return res.status(result.status).json(result);

  let activities = result.data.map((a: any) => ({
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

  // Client-side filtering by type
  if (type) {
    activities = activities.filter((a: any) => a.type.toLowerCase() === type.toLowerCase());
  }

  res.json(activities);
});

// 3. GET /tools/get_activity_details
const GetActivityDetailsSchema = z.object({
  id: z.string(),
});

router.get('/get_activity_details', async (req: Request, res: Response) => {
  const validation = GetActivityDetailsSchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(400).json({ error: 'Missing activity id', status: 400 });
  }

  const { id } = validation.data;
  const result = await stravaRequest('GET', `/activities/${id}`, req.accessToken!);
  if ('error' in result) return res.status(result.status).json(result);

  const a = result.data;
  res.json({
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
  });
});

// 4. POST /tools/create_activity
const CreateActivitySchema = z.object({
  name: z.string(),
  type: z.string(),
  distance: z.number(),
  moving_time: z.number(),
  start_date_local: z.string(),
  description: z.string().optional(),
});

router.post('/create_activity', async (req: Request, res: Response) => {
  const validation = CreateActivitySchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: validation.error.format(), status: 400 });
  }

  const result = await stravaRequest('POST', '/activities', req.accessToken!, {}, validation.data);
  if ('error' in result) return res.status(result.status).json(result);

  res.json({ id: result.data.id, name: result.data.name });
});

// 5. PUT /tools/update_activity
const UpdateActivitySchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  description: z.string().optional(),
  gear_id: z.string().optional(),
});

router.put('/update_activity', async (req: Request, res: Response) => {
  const idQuery = req.query.id as string;
  if (!idQuery) return res.status(400).json({ error: 'Missing activity id', status: 400 });

  const validation = UpdateActivitySchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: validation.error.format(), status: 400 });
  }

  const result = await stravaRequest('PUT', `/activities/${idQuery}`, req.accessToken!, {}, validation.data);
  if ('error' in result) return res.status(result.status).json(result);

  // Return updated fields as requested
  const updatedFields: any = {};
  if (validation.data.name) updatedFields.name = result.data.name;
  if (validation.data.type) updatedFields.type = result.data.type;
  if (validation.data.description) updatedFields.description = result.data.description;
  if (validation.data.gear_id) updatedFields.gear_id = result.data.gear_id;

  res.json(updatedFields);
});

// 6. GET /tools/get_athlete_stats
router.get('/get_athlete_stats', async (req: Request, res: Response) => {
  const athleteId = req.user.strava_athlete_id;
  const result = await stravaRequest('GET', `/athletes/${athleteId}/stats`, req.accessToken!);
  
  if ('error' in result) return res.status(result.status).json(result);

  const s = result.data;
  res.json({
    ytd_run_totals: s.ytd_run_totals,
    ytd_ride_totals: s.ytd_ride_totals,
    ytd_swim_totals: s.ytd_swim_totals,
    all_run_totals: s.all_run_totals,
    all_ride_totals: s.all_ride_totals,
    all_swim_totals: s.all_swim_totals,
  });
});

// 7. GET /tools/get_segments
const GetSegmentsSchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radius: z.coerce.number().min(0.1).max(10).default(1),
  activity_type: z.enum(['riding', 'running']).optional(),
});

router.get('/get_segments', async (req: Request, res: Response) => {
  const validation = GetSegmentsSchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(400).json({ error: validation.error.format(), status: 400 });
  }

  const { lat, lng, radius, activity_type } = validation.data;
  
  // Create a bounding box based on radius (1km ≈ 0.009 degrees lat)
  const offset = radius * 0.009;
  const bounds = `${lat - offset},${lng - offset},${lat + offset},${lng + offset}`;

  const params: any = { bounds };
  if (activity_type) params.activity_type = activity_type;

  const result = await stravaRequest('GET', '/segments/explore', req.accessToken!, params);
  if ('error' in result) return res.status(result.status).json(result);

  const segments = result.data.segments.map((s: any) => ({
    id: s.id,
    name: s.name,
    distance: s.distance,
    avg_grade: s.avg_grade,
    climb_category: s.climb_category,
    city: s.city,
  }));

  res.json(segments);
});

// 8. GET /tools/get_segment_efforts
const GetSegmentEffortsSchema = z.object({
  id: z.string(),
});

router.get('/get_segment_efforts', async (req: Request, res: Response) => {
  const validation = GetSegmentEffortsSchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(400).json({ error: 'Missing segment id', status: 400 });
  }

  const { id } = validation.data;
  // athlete_id parameter on this endpoint will filter for the current user's efforts
  const result = await stravaRequest('GET', `/segments/${id}/all_efforts`, req.accessToken!, { 
    athlete_id: req.user.strava_athlete_id,
    per_page: 50 // moderate limit
  });
  
  if ('error' in result) return res.status(result.status).json(result);

  const efforts = result.data.map((e: any) => ({
    id: e.id,
    elapsed_time: e.elapsed_time,
    moving_time: e.moving_time,
    start_date: e.start_date,
    average_speed: e.average_speed,
  }));

  res.json(efforts);
});

export default router;
