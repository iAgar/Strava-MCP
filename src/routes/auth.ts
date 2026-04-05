import { Router, Request, Response } from 'express';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';

const router = Router();

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const STRAVA_REDIRECT_URI = process.env.STRAVA_REDIRECT_URI;

if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !STRAVA_REDIRECT_URI) {
  console.warn('Strava OAuth environment variables are missing');
}

// Redirect to Strava OAuth
router.get('/login', (req: Request, res: Response) => {
  const scope = 'read,activity:read_all,activity:write';
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&redirect_uri=${STRAVA_REDIRECT_URI}&response_type=code&scope=${scope}`;
  res.redirect(authUrl);
});

// Handle Strava OAuth callback
router.get('/callback', async (req: Request, res: Response) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
  }

  try {
    // 1. Exchange code for tokens
    const tokenResponse = await axios.post('https://www.strava.com/oauth/token', {
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    });

    const { access_token, refresh_token, expires_at, athlete } = tokenResponse.data;
    const stravaAthleteId = athlete.id.toString();

    // 2. Upsert user in the database
    const user = await prisma.user.upsert({
      where: { strava_athlete_id: stravaAthleteId },
      update: {
        access_token,
        refresh_token,
        expires_at,
      },
      create: {
        strava_athlete_id: stravaAthleteId,
        access_token,
        refresh_token,
        expires_at,
      },
    });

    // 3. Generate session ID and store in database
    const sessionId = uuidv4();
    // @ts-ignore: Prisma session model is sometimes not recognized by linting despite being in schema
    await (prisma as any).session.create({
      data: {
        sessionId,
        userId: user.id,
      },
    });

    // 4. Return session ID to the client
    res.json({ session_id: sessionId });
  } catch (error: any) {
    console.error('Strava OAuth callback error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

export default router;
