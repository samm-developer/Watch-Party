import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import { io, Socket } from 'socket.io-client';
import YouTubePlayer from '../components/YouTubePlayer';

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [userCount, setUserCount] = useState(0);
  const [videoUrl, setVideoUrl] = useState('');
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const playerRef = useRef<any>(null);
  const isSyncingRef = useRef(false);
  const lastSyncTimeRef = useRef(0);

  useEffect(() => {
    // Initialize Socket.io connection
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    const newSocket = io(backendUrl, {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    // Handle initial session state
    newSocket.on('sessionState', (state: any) => {
      console.log('Received session state:', state);
      if (state.videoId) {
        setCurrentVideoId(state.videoId);
        setVideoUrl(state.videoUrl || '');
        
        // Sync player to current state
        if (playerRef.current) {
          isSyncingRef.current = true;
          playerRef.current.seekTo(state.currentTime || 0, true);
          if (state.isPlaying) {
            playerRef.current.playVideo();
          } else {
            playerRef.current.pauseVideo();
          }
          setTimeout(() => {
            isSyncingRef.current = false;
          }, 1000);
        }
      }
    });

    // Handle user count updates
    newSocket.on('userCount', (count: number) => {
      setUserCount(count);
    });

    // Handle video change from other users
    newSocket.on('videoChanged', (data: { videoUrl: string; videoId: string }) => {
      setCurrentVideoId(data.videoId);
      setVideoUrl(data.videoUrl);
    });

    // Handle play action from other users
    newSocket.on('play', (data: { currentTime: number; timestamp: number }) => {
      if (playerRef.current && !isSyncingRef.current) {
        isSyncingRef.current = true;
        const timeDiff = (Date.now() - data.timestamp) / 1000;
        const adjustedTime = data.currentTime + timeDiff;
        playerRef.current.seekTo(adjustedTime, true);
        playerRef.current.playVideo();
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 500);
      }
    });

    // Handle pause action from other users
    newSocket.on('pause', (data: { currentTime: number; timestamp: number }) => {
      if (playerRef.current && !isSyncingRef.current) {
        isSyncingRef.current = true;
        const timeDiff = (Date.now() - data.timestamp) / 1000;
        const adjustedTime = data.currentTime + timeDiff;
        playerRef.current.seekTo(adjustedTime, true);
        playerRef.current.pauseVideo();
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 500);
      }
    });

    // Handle seek action from other users
    newSocket.on('seek', (data: { time: number; timestamp: number }) => {
      if (playerRef.current && !isSyncingRef.current) {
        isSyncingRef.current = true;
        const timeDiff = (Date.now() - data.timestamp) / 1000;
        const adjustedTime = data.time + timeDiff;
        playerRef.current.seekTo(adjustedTime, true);
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 500);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const handleVideoUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (socket && videoUrl.trim()) {
      socket.emit('changeVideo', { url: videoUrl.trim() });
    }
  };

  const handlePlayerReady = (player: any) => {
    playerRef.current = player;
  };

  const handlePlay = () => {
    if (socket && playerRef.current && !isSyncingRef.current) {
      const currentTime = playerRef.current.getCurrentTime();
      socket.emit('play', { currentTime });
    }
  };

  const handlePause = () => {
    if (socket && playerRef.current && !isSyncingRef.current) {
      const currentTime = playerRef.current.getCurrentTime();
      socket.emit('pause', { currentTime });
    }
  };

  const handleSeek = (time: number) => {
    if (socket && !isSyncingRef.current) {
      socket.emit('seek', { time });
    }
  };

  return (
    <>
      <Head>
        <title>Watch Party - Shared YouTube Viewing</title>
        <meta name="description" content="Watch YouTube videos together in sync" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="container">
        <div className="header">
          <h1>Watch Party</h1>
          <div className="user-count">
            <span className="user-icon">👥</span>
            <span>{userCount} {userCount === 1 ? 'user' : 'users'} watching</span>
          </div>
        </div>

        <div className="video-section">
          <form onSubmit={handleVideoUrlSubmit} className="url-form">
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Enter YouTube URL (e.g., https://www.youtube.com/watch?v=...)"
              className="url-input"
            />
            <button type="submit" className="submit-btn">
              Load Video
            </button>
          </form>

          {currentVideoId && (
            <YouTubePlayer
              videoId={currentVideoId}
              onReady={handlePlayerReady}
              onPlay={handlePlay}
              onPause={handlePause}
              onSeek={handleSeek}
            />
          )}

          {!currentVideoId && (
            <div className="placeholder">
              <p>Enter a YouTube URL above to start watching together!</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

