import React, { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  ControlBar,
  useDisconnectButton
} from '@livekit/components-react';
import '@livekit/components-styles';

interface LiveKitCallUIProps {
  token: string;
  roomName: string;
  serverUrl: string;
  type: 'video' | 'audio';
  onDisconnect: () => void;
  targetName?: string;
}

export const LiveKitCallUI: React.FC<LiveKitCallUIProps> = ({
  token,
  roomName,
  serverUrl,
  type,
  onDisconnect,
  targetName
}) => {
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/70 to-transparent text-white">
        <div>
          <h2 className="text-xl font-bold">{targetName || 'LiveKit Prototype Call'}</h2>
          <p className="text-sm opacity-80">
            {type === 'video' ? 'Video Call' : 'Audio Call'} • {formatTime(timer)}
          </p>
        </div>
      </div>

      <LiveKitRoom
        video={type === 'video'}
        audio={true}
        token={token}
        serverUrl={serverUrl}
        onDisconnected={onDisconnect}
        className="flex-1 relative"
      >
        <VideoConference />
        <RoomAudioRenderer />
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
            <ControlBar variation="minimal" controls={{ leave: true, chat: false, screenShare: false }} />
        </div>
      </LiveKitRoom>
    </div>
  );
};
