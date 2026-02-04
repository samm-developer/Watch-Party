import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YouTubePlayerProps {
  videoId: string;
  onReady: (player: any) => void;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
}

export default function YouTubePlayer({
  videoId,
  onReady,
  onPlay,
  onPause,
  onSeek,
}: YouTubePlayerProps) {
  const playerRef = useRef<HTMLDivElement>(null);
  const playerInstanceRef = useRef<any>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const isInternalChangeRef = useRef(false);

  useEffect(() => {
    // Load YouTube IFrame API
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        createPlayer();
      };
    } else {
      createPlayer();
    }

    function createPlayer() {
      if (!playerRef.current || !window.YT) return;

      playerInstanceRef.current = new window.YT.Player(playerRef.current, {
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (event: any) => {
            setIsPlayerReady(true);
            onReady(event.target);
          },
          onStateChange: (event: any) => {
            // YT.PlayerState.PLAYING = 1
            // YT.PlayerState.PAUSED = 2
            // YT.PlayerState.ENDED = 0
            
            if (!isInternalChangeRef.current) {
              if (event.data === 1) {
                // Playing
                onPlay();
              } else if (event.data === 2) {
                // Paused
                onPause();
              }
            }
          },
        },
      });
    }

    return () => {
      if (playerInstanceRef.current) {
        try {
          playerInstanceRef.current.destroy();
        } catch (e) {
          console.error('Error destroying player:', e);
        }
      }
    };
  }, []);

  // Update video when videoId changes
  useEffect(() => {
    if (playerInstanceRef.current && isPlayerReady && videoId) {
      isInternalChangeRef.current = true;
      playerInstanceRef.current.loadVideoById(videoId);
      setTimeout(() => {
        isInternalChangeRef.current = false;
      }, 1000);
    }
  }, [videoId, isPlayerReady]);

  // Handle seek events from video controls
  useEffect(() => {
    if (!playerRef.current || !isPlayerReady) return;

    // Track last known time and state
    let lastTime = 0;
    let lastState = -1;
    let seekTimeout: NodeJS.Timeout | null = null;

    const checkInterval = setInterval(() => {
      if (playerInstanceRef.current && !isInternalChangeRef.current) {
        const currentTime = playerInstanceRef.current.getCurrentTime();
        const currentState = playerInstanceRef.current.getPlayerState();
        
        // Detect seek: time jump > 1 second or state change to buffering (3) after pause/play
        const timeDiff = Math.abs(currentTime - lastTime);
        const isBuffering = currentState === 3; // YT.PlayerState.BUFFERING
        
        if (lastTime > 0) {
          // If time jumped significantly (more than 1.5 seconds), it's a seek
          if (timeDiff > 1.5 && !isBuffering) {
            // Clear any pending seek timeout
            if (seekTimeout) {
              clearTimeout(seekTimeout);
            }
            // Small delay to ensure the seek is complete
            seekTimeout = setTimeout(() => {
              if (!isInternalChangeRef.current) {
                onSeek(currentTime);
              }
            }, 300);
          }
          // If buffering after a state change, might be a seek
          else if (isBuffering && lastState !== 3 && lastState !== -1) {
            if (seekTimeout) {
              clearTimeout(seekTimeout);
            }
            seekTimeout = setTimeout(() => {
              if (!isInternalChangeRef.current && playerInstanceRef.current) {
                const finalTime = playerInstanceRef.current.getCurrentTime();
                if (Math.abs(finalTime - lastTime) > 1) {
                  onSeek(finalTime);
                }
              }
            }, 500);
          }
        }
        
        lastTime = currentTime;
        lastState = currentState;
      }
    }, 300); // Check every 300ms for better responsiveness

    return () => {
      clearInterval(checkInterval);
      if (seekTimeout) {
        clearTimeout(seekTimeout);
      }
    };
  }, [isPlayerReady, onSeek]);

  return (
    <div className="player-container">
      <div ref={playerRef} className="youtube-player"></div>
    </div>
  );
}

