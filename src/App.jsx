import React, { useState, useEffect } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';

const APP_ID = 'c176822ce0124489b643043f1a1a98c8';
const BACKEND_URL ='https://freshbackendvc.onrender.com';

export default function App() {
  const [step, setStep] = useState('home'); // 'home' or 'call'
  const [loading, setLoading] = useState(false); // new loading state
  const [channelName, setChannelName] = useState('');
  const [username, setUsername] = useState('');
  const [client, setClient] = useState(null);
  const [localTrack, setLocalTrack] = useState(null);
  const [remoteUsers, setRemoteUsers] = useState([]);

  const joinCall = async () => {
    if (!channelName || !username) return alert('Enter channel name and username');

    setLoading(true); // start loading

    try {
      // get token from backend
      const res = await fetch(`${BACKEND_URL}/getToken?channelName=${channelName}`);
      const data = await res.json();
      const token = data.token;
      const uid = data.uid;

      // init Agora client
      const agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      setClient(agoraClient);

      agoraClient.on('user-published', async (user, mediaType) => {
        await agoraClient.subscribe(user, mediaType);
        if (mediaType === 'video') {
          setRemoteUsers((prev) => [...prev, user]);
          user.videoTrack.play(`remote-player-${user.uid}`);
        }
        if (mediaType === 'audio') user.audioTrack.play();
      });

      agoraClient.on('user-unpublished', (user) => {
        setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
      });

      await agoraClient.join(APP_ID, channelName, token, uid);

      const [microphoneTrack, cameraTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
      setLocalTrack(cameraTrack);

      cameraTrack.play('local-player');
      await agoraClient.publish([microphoneTrack, cameraTrack]);

      setStep('call');
    } catch (err) {
      console.error('Error joining call:', err);
      alert('Failed to join call. Check console for details.');
    } finally {
      setLoading(false); // stop loading
    }
  };

  const leaveCall = async () => {
    localTrack?.close();
    await client?.leave();
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
          {loading && <p style={{ color: 'orange' }}>Loading call...</p>}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div>
              <h3>Local</h3>
              <div id="local-player" style={{ width: 320, height: 240, backgroundColor: '#000' }} />
            </div>
            {remoteUsers.map((user) => (
              <div key={user.uid}>
                <h3>Remote {user.uid}</h3>
                <div
                  id={`remote-player-${user.uid}`}
                  style={{ width: 320, height: 240, backgroundColor: '#000' }}
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