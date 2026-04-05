import express from 'express';
import dotenv from 'dotenv';
import { prisma } from './lib/prisma';
import authRoutes from './routes/auth';
import { authMiddleware } from './middleware/auth';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Public routes
app.get('/health', (req, res) => {
  res.json({ status: "ok" });
});

// Auth routes
app.use('/auth', authRoutes);

// Protected routes (for testing)
app.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user, accessToken: req.accessToken });
});

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('Database connection successful');

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }
}

startServer();
