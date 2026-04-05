import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import { prisma } from './lib/prisma';
import authRoutes from './routes/auth';
import { authMiddleware } from './middleware/auth';
import toolRoutes from './routes/tools';
import { mcpServer } from './lib/mcp';
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// MCP Protocol Layer (HTTP Transport)
let transport: SSEServerTransport;

app.get("/sse", async (req, res) => {
  transport = new SSEServerTransport("/messages", res);
  await mcpServer.connect(transport);
});

app.post("/messages", async (req, res) => {
  await transport.handlePostMessage(req, res);
});

// Public routes
app.get('/health', (req, res) => {
  res.json({ status: "ok" });
});

// Auth routes
app.use('/auth', authRoutes);

// Tools routes (Protected)
app.use('/tools', authMiddleware, toolRoutes);

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
