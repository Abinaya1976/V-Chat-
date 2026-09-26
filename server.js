const http = require('http');
const path = require('path');
const express = require('express');
const dotenv = require('dotenv');

// Load environment variables from .env file FIRST and override existing
dotenv.config({ path: path.join(__dirname, '.env'), override: true });

// --- STARTUP DIAGNOSTIC ---
const testKey = process.env.BREVO_API_KEY;
console.log('[STARTUP DIAGNOSTIC] BREVO_API_KEY exists:', !!testKey);
if (testKey) {
  console.log('[STARTUP DIAGNOSTIC] BREVO_API_KEY length:', testKey.length);
  console.log('[STARTUP DIAGNOSTIC] BREVO_API_KEY prefix:', testKey.substring(0, 8) + '...');
}
// --------------------------

const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const { initSocket } = require('./services/socketService');
const { initReminderScheduler } = require('./services/reminderScheduler');
const { initSystemBots } = require('./services/botService');
const { syncAllUsersCalendarEvents } = require('./services/googleCalendarService');

// Connect to MongoDB Database and Init Bots
connectDB().then(() => {
  initSystemBots();
  
  // Sync Calendar events every 15 minutes
  setInterval(() => {
    syncAllUsersCalendarEvents();
  }, 15 * 60 * 1000);
}).catch((err) => {
  console.warn('MongoDB connection warning:', err.message);
});

// Initialize Express application
const app = express();

// --- RUNTIME DIAGNOSTIC ENDPOINT ---
app.get('/api/diagnose-brevo', (req, res) => {
  const runtimeKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  
  res.json({
    success: true,
    diagnostic: {
      keyExists: !!runtimeKey,
      keyLength: runtimeKey ? runtimeKey.length : 0,
      keyPrefix: runtimeKey ? `${runtimeKey.substring(0, 8)}...` : null,
      senderEmail: senderEmail,
      envOverrides: process.env.BREVO_API_KEY === testKey ? 'Match Startup' : 'Changed after startup'
    }
  });
});
// -----------------------------------

// Create Node HTTP server wrapping Express
const server = http.createServer(app);

// Initialize Socket.IO with CORS configuration
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH'],
    credentials: true,
  },
});

// Initialize Socket.IO event architecture and middlewares
initSocket(io);

// Initialize server-side Reminder scheduler
initReminderScheduler(io);

// Store io reference on app for controller access
app.set('io', io);

// Global Middlewares
app.use(cors()); // Allow cross-origin requests from frontend
app.use(express.json()); // Parse incoming JSON request bodies

// Serve uploaded files statically with authentication
app.use('/uploads', (req, res, next) => {
  if (req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}, require('./middleware/authMiddleware').protect, express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, path, stat) => {
    if (res.req.query.download) {
      const filename = res.req.query.filename ? encodeURIComponent(res.req.query.filename) : 'download';
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }
  }
}));

// Health Check API Routes
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'ChatApp Backend is running with Socket.IO, Group Channels & File Sharing!',
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/conversations', require('./routes/conversationRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/pinned-messages', require('./routes/pinnedMessageRoutes'));
app.use('/api/saved-messages', require('./routes/savedMessageRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/channels', require('./routes/channelRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/search', require('./routes/searchRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/organizations', require('./routes/organizationRoutes'));
app.use('/api/todos', require('./routes/todoRoutes'));
app.use('/api/reminders', require('./routes/reminderRoutes'));
app.use('/api/notes', require('./routes/noteRoutes'));
app.use('/api/super-admin', require('./routes/superAdminRoutes'));
app.use('/api/invitations', require('./routes/invitationRoutes'));
app.use('/api/google', require('./routes/googleCalendarRoutes'));
app.use('/api/livekit', require('./routes/livekitRoutes'));

// Configure Port
const PORT = process.env.PORT || 5000;

// Handle server startup errors (such as port in use)
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use by another process.`);
    console.error(`💡 Tip: Close the process using port ${PORT} or configure PORT in backend/.env`);
  } else {
    console.error('❌ Server startup error:', err);
  }
});

// Start the HTTP and WebSocket Server listening on all interfaces (0.0.0.0)
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 ChatApp Backend server running on http://localhost:${PORT} with Socket.IO enabled`);
});
