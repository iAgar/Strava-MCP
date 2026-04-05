import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import { prisma } from './lib/prisma';
import authRoutes from './routes/auth';
import { authMiddleware } from './middleware/auth';
import toolRoutes from './routes/tools';
import { createMcpServer } from './lib/mcp';
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// MCP Protocol Layer (Streamable HTTP Transport)
app.all("/mcp", async (req, res) => {
  try {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on('close', () => { transport.close(); server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
    }
  }
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
