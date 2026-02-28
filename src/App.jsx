import React, { useState, useEffect, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';

const APP_ID = 'c176822ce0124489b643043f1a1a98c8'; 
const BACKEND_URL = 'https://freshbackendvc.onrender.com';

// 1. Create a helper component to safely mount Agora tracks in React
const VideoPlayer = ({ videoTrack, audioTrack, uid }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Play video track when the DOM element is ready
    if (videoTrack) {
      videoTrack.play(containerRef.current);
    }
    // Play audio (doesn't need a DOM container, but good to handle here)
    if (audioTrack) {
      audioTrack.play();
    }

    // Cleanup: stop playing when component unmounts
    return () => {
      if (videoTrack) videoTrack.stop();
      if (audioTrack) audioTrack.stop();
    };
  }, [videoTrack, audioTrack]);

  return (
    <div
      ref={containerRef}
      style={{
        width: 320,
        height: 240,
        backgroundColor: '#000',
        border: '1px solid #ccc',
      }}
    />
  );
};

export default function App() {
  const [step, setStep] = useState('home');
  const [loading, setLoading] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [username, setUsername] = useState('');
  const [client, setClient] = useState(null);
  
  // Store the actual track objects instead of just true/false
  const [localTracks, setLocalTracks] = useState({ video: null, audio: null });
  // Store the full user object to pass tracks to the VideoPlayer
  const [remoteUsers, setRemoteUsers] = useState([]);

  const joinCall = async () => {
    if (!channelName || !username) return alert('Enter channel name and username');
    setLoading(true);

    try {
      // Note: AgoraRTC.createMicrophoneAndCameraTracks() automatically asks for permissions,
      // so you don't strictly need navigator.mediaDevices.getUserMedia here anymore.

      const res = await fetch(`${BACKEND_URL}/getToken?channelName=${channelName}`);
      if (!res.ok) throw new Error('Failed to fetch token');
      const { token, uid } = await res.json();

      const agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      setClient(agoraClient);

      agoraClient.on('user-published', async (user, mediaType) => {
        await agoraClient.subscribe(user, mediaType);
        
        // Update state with the newly subscribed user/tracks
        setRemoteUsers((prev) => {
          // Prevent duplicates
          const filtered = prev.filter(u => u.uid !== user.uid);
          return [...filtered, user];
        });
      });

      agoraClient.on('user-unpublished', (user) => {
        setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
      });

      await agoraClient.join(APP_ID, channelName, token, uid);

      const [microphoneTrack, cameraTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
      setLocalTracks({ audio: microphoneTrack, video: cameraTrack });

      await agoraClient.publish([microphoneTrack, cameraTrack]);

      // Change step LAST, after all async setup is done
      setStep('call');
    } catch (err) {
      console.error('Error joining call:', err);
      alert('Failed to join call. Check your console and permissions.');
    } finally {
      setLoading(false);
    }
  };

  const leaveCall = async () => {
    // Close physical hardware tracks
    if (localTracks.video) localTracks.video.close();
    if (localTracks.audio) localTracks.audio.close();
    
    await client?.leave();
    
    // Reset all state
    setLocalTracks({ video: null, audio: null });
    setRemoteUsers([]);
    setStep('home');
  };

  return (
    <div style={{ padding: '20px' }}>
      {step === 'home' ? (
        <div>
          <h1>Join a Video Call</h1>
          <input
            placeholder="Channel Name"
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
          />
          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button onClick={joinCall} disabled={loading}>
            {loading ? 'Joining...' : 'Join Call'}
          </button>
        </div>
      ) : (
        <div>
          <h2>Channel: {channelName}</h2>
          
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div>
              <h3>Local</h3>
              {/* Use our new VideoPlayer component! */}
              {localTracks.video && (
                <VideoPlayer 
                  videoTrack={localTracks.video} 
                  audioTrack={null} // Local audio shouldn't be played locally (echo)
                />
              )}
            </div>

            {remoteUsers.map((user) => (
              <div key={user.uid}>
                <h3>Remote {user.uid}</h3>
                {/* Render remote tracks safely */}
                <VideoPlayer 
                  videoTrack={user.videoTrack} 
                  audioTrack={user.audioTrack} 
                />
              </div>
            ))}
          </div>

          <button onClick={leaveCall} style={{ marginTop: '20px' }}>
            Leave Call
          </button>
        </div>
      )}
    </div>
  );
}