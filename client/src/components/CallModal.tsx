import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Maximize, Minimize, User, Volume2, VolumeX } from 'lucide-react';

const RemoteMedia = ({ stream, isAudioOnly, forceSpeaker }: { stream: MediaStream, isAudioOnly: boolean, forceSpeaker: boolean }) => {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      ref.current.play().catch(e => console.error("Autoplay prevented:", e));
    }
  }, [stream]);

  // Attempt to route audio if setSinkId is supported (desktop mostly)
  useEffect(() => {
    if (ref.current && typeof (ref.current as any).setSinkId === 'function') {
      (ref.current as any).setSinkId(forceSpeaker ? 'default' : '').catch(() => {});
    }
  }, [forceSpeaker]);

  if (isAudioOnly) {
    return <audio ref={ref as any} autoPlay playsInline />;
  }

  return <video ref={ref} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
};

export default function CallModal({
  localStream,
  remoteStreams = {},
  callStatus,
  callType,
  incomingCallData,
  isMuted,
  isVideoOff,
  onToggleAudio,
  onToggleVideo,
  onAccept,
  onDecline,
  onEndCall
}: any) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isSpeaker, setIsSpeaker] = useState(true);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    let interval: any;
    if (callStatus === 'connected') {
      interval = setInterval(() => setDuration(prev => prev + 1), 1000);
    } else {
      setDuration(0);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (callStatus === 'idle') return null;

  if (callStatus === 'ringing' && incomingCallData) {
    return (
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000, backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-color)', width: '300px' }}>
        <h3 style={{ margin: '0 0 1rem 0' }}>Incoming {incomingCallData.is_group ? 'Group ' : ''}{incomingCallData.type === 'video' ? 'Video' : 'Audio'} Call</h3>
        <p style={{ margin: '0 0 1.5rem 0' }}>{incomingCallData.caller_name} is calling you...</p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={onAccept} className="btn" style={{ flex: 1, backgroundColor: 'var(--success)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <Phone size={18} /> Answer
          </button>
          <button onClick={onDecline} className="btn" style={{ flex: 1, backgroundColor: 'var(--danger)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <PhoneOff size={18} /> Decline
          </button>
        </div>
      </div>
    );
  }

  const modalStyle: React.CSSProperties = isFullscreen ? {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    backgroundColor: 'var(--bg-primary)',
    display: 'flex', flexDirection: 'column'
  } : {
    position: 'fixed',
    top: '20px', right: '20px',
    width: 'clamp(280px, calc(100vw - 40px), 320px)',
    zIndex: 1000,
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border-color)',
    overflow: 'hidden',
    display: 'flex', flexDirection: 'column'
  };

  const streamsArray = Object.values(remoteStreams) as MediaStream[];
  const numStreams = streamsArray.length;
  
  // Calculate grid layout based on number of participants
  let gridTemplateColumns = '1fr';
  if (numStreams > 1) gridTemplateColumns = '1fr 1fr';
  if (numStreams > 4) gridTemplateColumns = '1fr 1fr 1fr';

  return (
    <div style={modalStyle}>
      <div style={{ padding: '1rem', backgroundColor: 'var(--bg-tertiary)', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {callStatus === 'calling' ? 'Calling...' : `In ${callType === 'video' ? 'Video' : 'Audio'} Call`}
          <span style={{ fontSize: '0.75rem', color: 'var(--success)', backgroundColor: 'rgba(0, 255, 0, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
            {callStatus === 'connected' ? formatTime(duration) : callStatus}
          </span>
        </div>
        <button onClick={() => setIsFullscreen(!isFullscreen)} className="btn" style={{ padding: '0.25rem', color: 'var(--text-secondary)' }}>
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>
      </div>
      
      <div style={{ position: 'relative', flex: 1, minHeight: isFullscreen ? '0' : '240px', backgroundColor: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {callType === 'video' ? (
          <>
            {numStreams > 0 ? (
              <div style={{ width: '100%', height: '100%', display: 'grid', gridTemplateColumns, gap: '2px', backgroundColor: '#222' }}>
                {streamsArray.map((stream, idx) => (
                  <div key={stream.id || idx} style={{ position: 'relative', width: '100%', height: '100%' }}>
                    <RemoteMedia stream={stream} isAudioOnly={false} forceSpeaker={true} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'white' }}>Waiting for connection...</div>
            )}
            
            <div style={{ 
              position: 'absolute', 
              bottom: '20px', 
              right: '20px', 
              width: isFullscreen ? '150px' : '80px', 
              height: isFullscreen ? '200px' : '100px', 
              backgroundColor: '#333', 
              borderRadius: 'var(--radius-sm)', 
              overflow: 'hidden', 
              border: '2px solid white',
              boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
            }}>
              {localStream && (
                <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </div>
          </>
        ) : (
          <div style={{ color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={40} color="white" />
            </div>
            {numStreams > 0 ? (
              <>
                <div>Connected ({numStreams} participants)</div>
                {streamsArray.map((stream, idx) => (
                  <RemoteMedia key={stream.id || idx} stream={stream} isAudioOnly={true} forceSpeaker={isSpeaker} />
                ))}
              </>
            ) : (
              <div>Waiting for connection...</div>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: '1rem', display: 'flex', justifyContent: 'center', gap: '1rem', backgroundColor: isFullscreen ? '#1a1a1a' : 'transparent' }}>
        <button onClick={onToggleAudio} className="btn" style={{ borderRadius: '50%', padding: '0.75rem', backgroundColor: isMuted ? 'var(--danger)' : 'var(--bg-tertiary)', color: isMuted ? 'white' : 'var(--text-primary)', display: 'flex' }}>
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        {callType === 'video' && (
          <button onClick={onToggleVideo} className="btn" style={{ borderRadius: '50%', padding: '0.75rem', backgroundColor: isVideoOff ? 'var(--danger)' : 'var(--bg-tertiary)', color: isVideoOff ? 'white' : 'var(--text-primary)', display: 'flex' }}>
            {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>
        )}
        {callType === 'audio' && (
          <button onClick={() => setIsSpeaker(!isSpeaker)} className="btn" style={{ borderRadius: '50%', padding: '0.75rem', backgroundColor: isSpeaker ? 'var(--bg-tertiary)' : 'var(--bg-secondary)', color: isSpeaker ? 'var(--accent-primary)' : 'var(--text-primary)', display: 'flex' }}>
            {isSpeaker ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
        )}
        <button onClick={onEndCall} className="btn" style={{ borderRadius: '50%', padding: '0.75rem', backgroundColor: 'var(--danger)', color: 'white', display: 'flex' }}>
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  );
}
