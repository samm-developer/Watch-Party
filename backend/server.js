const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

// Global session state
let sessionState = {
  videoUrl: null,
  videoId: null,
  isPlaying: false,
  currentTime: 0,
  lastUpdateTime: Date.now(),
  userCount: 0
};

// Helper function to extract YouTube video ID from URL
function extractYouTubeId(url) {
  if (!url) return null;
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  sessionState.userCount++;
  
  // Send current session state to newly connected user
  socket.emit('sessionState', sessionState);
  
  // Broadcast updated user count
  io.emit('userCount', sessionState.userCount);
  
  // Handle video URL change
  socket.on('changeVideo', (data) => {
    const { url } = data;
    const videoId = extractYouTubeId(url);
    
    if (videoId) {
      sessionState.videoUrl = url;
      sessionState.videoId = videoId;
      sessionState.isPlaying = false;
      sessionState.currentTime = 0;
      sessionState.lastUpdateTime = Date.now();
      
      // Broadcast to all users
      io.emit('videoChanged', {
        videoUrl: sessionState.videoUrl,
        videoId: sessionState.videoId
      });
      
      console.log('Video changed to:', videoId);
    }
  });
  
  // Handle play action
  socket.on('play', (data) => {
    const { currentTime } = data;
    sessionState.isPlaying = true;
    sessionState.currentTime = currentTime || 0;
    sessionState.lastUpdateTime = Date.now();
    
    // Broadcast to all other users
    socket.broadcast.emit('play', {
      currentTime: sessionState.currentTime,
      timestamp: sessionState.lastUpdateTime
    });
    
    console.log('Play action:', sessionState.currentTime);
  });
  
  // Handle pause action
  socket.on('pause', (data) => {
    const { currentTime } = data;
    sessionState.isPlaying = false;
    sessionState.currentTime = currentTime || 0;
    sessionState.lastUpdateTime = Date.now();
    
    // Broadcast to all other users
    socket.broadcast.emit('pause', {
      currentTime: sessionState.currentTime,
      timestamp: sessionState.lastUpdateTime
    });
    
    console.log('Pause action:', sessionState.currentTime);
  });
  
  // Handle seek action
  socket.on('seek', (data) => {
    const { time } = data;
    if (typeof time === 'number' && time >= 0) {
      sessionState.currentTime = time;
      sessionState.lastUpdateTime = Date.now();
      
      // Broadcast to all other users
      socket.broadcast.emit('seek', {
        time: sessionState.currentTime,
        timestamp: sessionState.lastUpdateTime
      });
      
      console.log('Seek action:', sessionState.currentTime);
    }
  });
  
  // Handle time update (for drift correction)
  socket.on('timeUpdate', (data) => {
    const { currentTime } = data;
    // Only update if the difference is significant (more than 2 seconds)
    // This prevents constant updates but allows drift correction
    if (Math.abs(sessionState.currentTime - currentTime) > 2) {
      sessionState.currentTime = currentTime;
      sessionState.lastUpdateTime = Date.now();
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    sessionState.userCount = Math.max(0, sessionState.userCount - 1);
    io.emit('userCount', sessionState.userCount);
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS enabled for: ${process.env.FRONTEND_URL || "http://localhost:3000"}`);
});

