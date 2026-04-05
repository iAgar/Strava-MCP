import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { prisma } from '../lib/prisma';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: any;
      accessToken?: string;
    }
  }
}

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.headers['x-session-id'] as string;

  if (!sessionId) {
    return res.status(401).json({ error: 'Missing x-session-id header' });
  }

  try {
    // Find valid session in the database and include associated user
    const session = await prisma.session.findUnique({
      where: { sessionId },
      include: { user: true },
    });

    if (!session || !session.user) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const { user } = session;
    const now = Math.floor(Date.now() / 1000);
    let accessToken = user.access_token;

    // Check if token is expired (with a 5-minute buffer)
    if (user.expires_at <= now + 300) {
      console.log(`Refreshing access token for user ${user.id}`);
      try {
        const refreshResponse = await axios.post('https://www.strava.com/oauth/token', {
          client_id: STRAVA_CLIENT_ID,
          client_secret: STRAVA_CLIENT_SECRET,
          refresh_token: user.refresh_token,
          grant_type: 'refresh_token',
        });

        const { access_token: newAccessToken, refresh_token: newRefreshToken, expires_at: newExpiresAt } = refreshResponse.data;

        // Update user in database
        const updatedUser = await prisma.user.update({
          where: { id: user.id },
          data: {
            access_token: newAccessToken,
            refresh_token: newRefreshToken,
            expires_at: newExpiresAt,
          },
        });

        accessToken = newAccessToken;
        req.user = updatedUser;
      } catch (refreshError: any) {
        console.error('Token refresh failed:', refreshError.response?.data || refreshError.message);
        return res.status(401).json({ error: 'Session expired, please log in again' });
      }
    } else {
      req.user = user;
    }

    req.accessToken = accessToken;
    next();
  } catch (error: any) {
    console.error('Authentication Error:', error.message);
    res.status(500).json({ error: 'Authentication internal error' });
  }
}
