import { useState, useRef, useEffect } from 'react';
import { getTurnServers } from '../services/api';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { 
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    { 
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    { 
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:freestun.net:3478', // Sometimes functions as a free TURN
      username: 'free',
      credential: 'free'
    }
  ]
};

export function useWebRTC(
  sendSignalingMessage: (event: string, payload: any) => void,
  onCallLogged?: (data: { duration: number, status: string, type: 'video' | 'audio' }) => void
) {
  const [localStream, _setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const setLocalStream = (stream: MediaStream | null) => {
    localStreamRef.current = stream;
    _setLocalStream(stream);
  };

  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const iceCandidateQueueRef = useRef<Record<string, RTCIceCandidateInit[]>>({});
  
  const [callStatus, _setCallStatus] = useState<'idle' | 'calling' | 'ringing' | 'connected'>('idle');
  const callStatusRef = useRef<'idle' | 'calling' | 'ringing' | 'connected'>('idle');
  const setCallStatus = (status: 'idle' | 'calling' | 'ringing' | 'connected') => {
    callStatusRef.current = status;
    _setCallStatus(status);
  };

  const [callType, setCallType] = useState<'video' | 'audio'>('video');
  const [incomingCallData, _setIncomingCallData] = useState<{ caller_id: string, caller_name: string, type: 'video' | 'audio', is_group?: boolean } | null>(null);
  const incomingCallDataRef = useRef<{ caller_id: string, caller_name: string, type: 'video' | 'audio', is_group?: boolean } | null>(null);
  const setIncomingCallData = (data: { caller_id: string, caller_name: string, type: 'video' | 'audio', is_group?: boolean } | null) => {
    incomingCallDataRef.current = data;
    _setIncomingCallData(data);
  };

  const dynamicIceServersRef = useRef<any>(ICE_SERVERS);

  // Fetch dynamic TURN servers from Twilio (via our backend)
  useEffect(() => {
    getTurnServers().then((res: any) => {
      if (res.success && res.data && res.data.length > 0) {
        dynamicIceServersRef.current = {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            ...res.data
          ]
        };
        console.log('[WebRTC] Fetched dynamic Twilio TURN credentials successfully.');
      }
    }).catch((e: any) => console.error('[WebRTC] Failed to fetch TURN servers:', e));
  }, []);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const [isCaller, setIsCaller] = useState(false);
  const callStartTimeRef = useRef<number | null>(null);

  const startLocalStream = async (type: 'video' | 'audio') => {
    try {
      console.log(`\n--- [DIAGNOSTIC] STEP 1: Local Media ---`);
      console.log(`[WebRTC] Requesting local stream... type: ${type}`);
      const stream = await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true });
      
      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];
      
      console.log(`[WebRTC] Local Audio: ${audioTrack ? `Exists (kind: ${audioTrack.kind}, enabled: ${audioTrack.enabled}, readyState: ${audioTrack.readyState}, muted: ${audioTrack.muted})` : 'MISSING'}`);
      console.log(`[WebRTC] Local Video: ${videoTrack ? `Exists (kind: ${videoTrack.kind}, enabled: ${videoTrack.enabled}, readyState: ${videoTrack.readyState}, muted: ${videoTrack.muted})` : 'MISSING'}`);
      console.log(`----------------------------------------\n`);
      
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('[WebRTC] Error accessing media devices:', err);
      throw err;
    }
  };

  const initPeerConnection = (targetId: string, stream: MediaStream) => {
    console.log(`[WebRTC] Initializing PeerConnection for target: ${targetId}`);
    if (peerConnectionsRef.current[targetId]) {
      console.log(`[WebRTC] Closing existing PeerConnection for target: ${targetId}`);
      peerConnectionsRef.current[targetId].close();
    }
    
    console.log(`[WebRTC] Using ICE Servers:`, dynamicIceServersRef.current);
    const pc = new RTCPeerConnection(dynamicIceServersRef.current);
    peerConnectionsRef.current[targetId] = pc;

    if (stream) {
      console.log(`\n--- [DIAGNOSTIC] STEP 2: PeerConnection Senders ---`);
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
      
      const senders = pc.getSenders();
      const audioSender = senders.find(s => s.track?.kind === 'audio');
      const videoSender = senders.find(s => s.track?.kind === 'video');
      console.log(`[WebRTC] Audio Sender: ${audioSender ? `Exists (track readyState: ${audioSender.track?.readyState})` : 'MISSING'}`);
      console.log(`[WebRTC] Video Sender: ${videoSender ? `Exists (track readyState: ${videoSender.track?.readyState})` : 'MISSING'}`);
      console.log(`---------------------------------------------------\n`);
    } else {
      console.warn(`[WebRTC] WARNING: No local stream provided to initPeerConnection!`);
    }

    pc.ontrack = (event) => {
      console.log(`\n--- [DIAGNOSTIC] STEP 5: Remote Track Arrived ---`);
      console.log(`[WebRTC] ontrack fired! event.track.kind: ${event.track.kind}, readyState: ${event.track.readyState}`);
      console.log(`[WebRTC] event.streams length: ${event.streams?.length}`);
      
      const stream = event.streams && event.streams[0];
      if (stream) {
        const audio = stream.getAudioTracks()[0];
        const video = stream.getVideoTracks()[0];
        console.log(`[WebRTC] Remote Stream Audio: ${audio ? 'Exists' : 'MISSING'}`);
        console.log(`[WebRTC] Remote Stream Video: ${video ? 'Exists' : 'MISSING'}`);
      }
      console.log(`-------------------------------------------------\n`);
      
      setRemoteStreams(prev => {
        if (!stream) {
          console.log(`[WebRTC] Fallback: No event.streams[0], using manual MediaStream.`);
          if (prev[targetId]) {
            prev[targetId].addTrack(event.track);
            return { ...prev };
          }
          return { ...prev, [targetId]: new MediaStream([event.track]) };
        }
        return { ...prev, [targetId]: stream };
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const typeMatch = event.candidate.candidate.match(/typ\s+(\w+)/);
        const candType = typeMatch ? typeMatch[1] : 'unknown';
        console.log(`[WebRTC] Generated ICE candidate: ${candType}`);
        sendSignalingMessage('ice_candidate', { target_id: targetId, candidate: event.candidate });
      } else {
        console.log(`[WebRTC] ICE candidate gathering complete.`);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`\n--- [DIAGNOSTIC] STEP 4: ICE State ---`);
      console.log(`[WebRTC] connectionState: ${pc.connectionState}`);
      console.log(`[WebRTC] iceConnectionState: ${pc.iceConnectionState}`);
      console.log(`[WebRTC] iceGatheringState: ${pc.iceGatheringState}`);
      console.log(`--------------------------------------\n`);
      
      if (pc.connectionState === 'connected') {
        // Start RTP Stats polling
        setTimeout(() => runDiagnosticStats(pc), 5000);
      }

      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        console.log(`[WebRTC] Connection lost/closed. Cleaning up streams.`);
        setRemoteStreams(prev => {
          const next = { ...prev };
          delete next[targetId];
          return next;
        });
        delete peerConnectionsRef.current[targetId];
        
        // If no more connections, end call
        if (Object.keys(peerConnectionsRef.current).length === 0 && callStatusRef.current === 'connected') {
          console.log(`[WebRTC] No active peer connections left. Ending call.`);
          endCall();
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] iceConnectionState changed to: ${pc.iceConnectionState}`);
    };

    return pc;
  };

  const runDiagnosticStats = async (pc: RTCPeerConnection) => {
    try {
      const stats = await pc.getStats();
      let audioSent = 0, videoSent = 0;
      let audioRecv = 0, videoRecv = 0;
      
      stats.forEach(report => {
        if (report.type === 'outbound-rtp') {
          if (report.kind === 'audio') audioSent = report.packetsSent;
          if (report.kind === 'video') videoSent = report.packetsSent;
        }
        if (report.type === 'inbound-rtp') {
          if (report.kind === 'audio') audioRecv = report.packetsReceived;
          if (report.kind === 'video') videoRecv = report.packetsReceived;
        }
      });
      
      console.log(`\n=== FINAL REPORT: RTP STATISTICS (5s after connect) ===`);
      console.log(`Audio packets sent: ${audioSent}`);
      console.log(`Audio packets received: ${audioRecv}`);
      console.log(`Video packets sent: ${videoSent}`);
      console.log(`Video packets received: ${videoRecv}`);
      console.log(`=======================================================\n`);
      
    } catch (e) {
      console.error('[WebRTC] Failed to get stats', e);
    }
  };

  // 1. Someone initiates a call
  const initiateCall = async (callerName: string, type: 'video' | 'audio' = 'video', isGroup: boolean = false) => {
    try {
      setIsCaller(true);
      setCallType(type);
      await startLocalStream(type);
      setCallStatus(isGroup ? 'connected' : 'calling');
      
      // Tell everyone in the room we started a call / joined
      sendSignalingMessage('peer_join', { caller_name: callerName, type, is_group: isGroup });
    } catch (err) {
      console.error('Failed to initiate call', err);
      endCall();
    }
  };

  const handlePeerJoin = async (sender_id: string, caller_name: string, type: 'video' | 'audio', is_group: boolean = false) => {
    console.log(`[WebRTC] Peer joined: ${sender_id}, status: ${callStatusRef.current}`);
    if (callStatusRef.current === 'idle') {
      setCallStatus('ringing');
      setCallType(type);
      setIncomingCallData({ caller_name, type, is_group, caller_id: sender_id });
    } else if ((callStatusRef.current === 'connected' || callStatusRef.current === 'calling') && localStreamRef.current) {
      if (callStatusRef.current === 'calling') {
        console.log(`[WebRTC] Upgrading call status from calling to connected`);
        setCallStatus('connected');
      }
      
      try {
        const pc = initPeerConnection(sender_id, localStreamRef.current);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        console.log(`\n--- [DIAGNOSTIC] STEP 3: SDP Inspection (OFFER) ---`);
        const audioLines = offer.sdp?.match(/m=audio.*/g);
        const videoLines = offer.sdp?.match(/m=video.*/g);
        console.log(`[WebRTC] m=audio: ${audioLines ? audioLines[0] : 'MISSING'}`);
        console.log(`[WebRTC] m=video: ${videoLines ? videoLines[0] : 'MISSING'}`);
        console.log(`---------------------------------------------------\n`);
        
        sendSignalingMessage('call_offer', { target_id: sender_id, offer, type });
      } catch (e) {
        console.error(`[WebRTC] Failed to create offer:`, e);
      }
    }
  };

  // 3. User accepts the incoming call prompt
  const acceptCall = async () => {
    try {
      const type = incomingCallDataRef.current?.type || 'video';
      await startLocalStream(type);
      setCallStatus('connected');
      
      // Tell the person who invited us (and others) that we joined
      sendSignalingMessage('peer_join', { caller_name: incomingCallDataRef.current?.caller_name, type, is_group: incomingCallDataRef.current?.is_group });
      setIncomingCallData(null);
    } catch (err) {
      console.error('Failed to accept call', err);
      endCall();
    }
  };

  // 4. New user receives offers from existing users
  const handleReceiveOffer = async (offer: RTCSessionDescriptionInit, sender_id: string) => {
    console.log(`[WebRTC] Received offer from ${sender_id}. Current status: ${callStatusRef.current}`);
    if (callStatusRef.current !== 'connected' || !localStreamRef.current) {
      console.warn(`[WebRTC] Ignoring offer. Status is not connected OR localStream is null.`);
      return;
    }
    try {
      console.log(`[WebRTC] Setting remote description from offer...`);
      const pc = initPeerConnection(sender_id, localStreamRef.current);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log(`[WebRTC] Remote description set successfully.`);
      
      // Process queued ICE candidates
      if (iceCandidateQueueRef.current[sender_id]) {
        console.log(`[WebRTC] Processing ${iceCandidateQueueRef.current[sender_id].length} queued ICE candidates...`);
        for (const candidate of iceCandidateQueueRef.current[sender_id]) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error('[WebRTC] Queued ICE error:', e));
        }
        delete iceCandidateQueueRef.current[sender_id];
      }

      console.log(`[WebRTC] Creating answer...`);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      console.log(`\n--- [DIAGNOSTIC] STEP 3: SDP Inspection (ANSWER) ---`);
      const audioLines = answer.sdp?.match(/m=audio.*/g);
      const videoLines = answer.sdp?.match(/m=video.*/g);
      console.log(`[WebRTC] m=audio: ${audioLines ? audioLines[0] : 'MISSING'}`);
      console.log(`[WebRTC] m=video: ${videoLines ? videoLines[0] : 'MISSING'}`);
      console.log(`----------------------------------------------------\n`);
      
      sendSignalingMessage('call_answer', { target_id: sender_id, answer });
    } catch (e) {
      console.error('[WebRTC] Failed to handle offer', e);
    }
  };

  // 5. Existing user receives answer from new user
  const handleReceiveAnswer = async (answer: RTCSessionDescriptionInit, sender_id: string) => {
    console.log(`[WebRTC] Received answer from ${sender_id}`);
    const pc = peerConnectionsRef.current[sender_id];
    if (!pc) {
      console.warn(`[WebRTC] No PeerConnection found for ${sender_id} when receiving answer!`);
      return;
    }
    try {
      console.log(`[WebRTC] Setting remote description from answer...`);
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      console.log(`[WebRTC] Remote description set successfully from answer.`);
      
      // Process queued ICE candidates
      if (iceCandidateQueueRef.current[sender_id]) {
        console.log(`[WebRTC] Processing ${iceCandidateQueueRef.current[sender_id].length} queued ICE candidates...`);
        for (const candidate of iceCandidateQueueRef.current[sender_id]) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error('[WebRTC] Queued ICE error:', e));
        }
        delete iceCandidateQueueRef.current[sender_id];
      }

      if (!callStartTimeRef.current) callStartTimeRef.current = Date.now();
    } catch (e) {
      console.error('[WebRTC] Failed to set remote description on answer', e);
    }
  };

  // 6. ICE candidates exchange
  const handleReceiveIceCandidate = async (candidate: RTCIceCandidateInit, sender_id: string) => {
    const pc = peerConnectionsRef.current[sender_id];
    if (!pc || !pc.remoteDescription) {
      console.log(`[WebRTC] Queuing ICE candidate from ${sender_id} (PC exists: ${!!pc}, RemoteDesc exists: ${!!pc?.remoteDescription})`);
      if (!iceCandidateQueueRef.current[sender_id]) {
        iceCandidateQueueRef.current[sender_id] = [];
      }
      iceCandidateQueueRef.current[sender_id].push(candidate);
      return;
    }
    try {
      console.log(`[WebRTC] Adding ICE candidate from ${sender_id}`);
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error('[WebRTC] Error adding ICE candidate', e);
    }
  };

  const endCall = () => {
    sendSignalingMessage('peer_leave', {});
    cleanup();
  };

  const handlePeerLeave = (sender_id: string, is_group: boolean = false) => {
    if (peerConnectionsRef.current[sender_id]) {
      peerConnectionsRef.current[sender_id].close();
      delete peerConnectionsRef.current[sender_id];
    }
    setRemoteStreams(prev => {
      const next = { ...prev };
      delete next[sender_id];
      return next;
    });
    
    if (callStatusRef.current === 'ringing' && incomingCallDataRef.current?.caller_id === sender_id) {
      cleanup(); // The caller hung up before we answered
    } else if (callStatusRef.current === 'calling' && !is_group) {
      cleanup(); // The receiver declined the call
    } else if (callStatusRef.current === 'connected' && Object.keys(peerConnectionsRef.current).length === 0 && !is_group) {
      cleanup(); // The other person left the 1-on-1 call
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const cleanup = () => {
    if (isCaller && callStatusRef.current !== 'idle') {
      let duration = 0;
      let status = 'missed';
      
      if (callStatusRef.current === 'connected' && callStartTimeRef.current) {
        duration = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
        status = 'answered';
      } else if (callStatusRef.current === 'calling' || callStatusRef.current === 'ringing') {
        status = 'missed'; // or declined
      }
      
      if (onCallLogged) {
        onCallLogged({ duration, status, type: callType });
      }
    }

    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    peerConnectionsRef.current = {};
    iceCandidateQueueRef.current = {};
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    setRemoteStreams({});
    setCallStatus('idle');
    setIncomingCallData(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsCaller(false);
    callStartTimeRef.current = null;
  };

  return {
    localStream,
    remoteStreams,
    callStatus,
    callType,
    incomingCallData,
    isMuted,
    isVideoOff,
    initiateCall,
    acceptCall,
    handlePeerJoin,
    handleReceiveOffer,
    handleReceiveAnswer,
    handleReceiveIceCandidate,
    handlePeerLeave,
    endCall,
    cleanup,
    toggleAudio,
    toggleVideo
  };
}
