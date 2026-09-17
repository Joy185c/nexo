import { useState, useRef } from 'react';

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

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const [isCaller, setIsCaller] = useState(false);
  const callStartTimeRef = useRef<number | null>(null);

  const startLocalStream = async (type: 'video' | 'audio') => {
    try {
      console.log(`[WebRTC] Requesting local stream... type: ${type}`);
      const stream = await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true });
      console.log(`[WebRTC] Local stream obtained successfully. Tracks:`, stream.getTracks().map(t => `${t.kind} (${t.enabled ? 'enabled' : 'disabled'})`));
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
    
    console.log(`[WebRTC] Using ICE Servers:`, ICE_SERVERS);
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current[targetId] = pc;

    if (stream) {
      console.log(`[WebRTC] Adding local tracks to PeerConnection...`);
      stream.getTracks().forEach((track) => {
        console.log(`[WebRTC] Adding track: ${track.kind}`);
        pc.addTrack(track, stream);
      });
    } else {
      console.warn(`[WebRTC] WARNING: No local stream provided to initPeerConnection!`);
    }

    pc.ontrack = (event) => {
      console.log(`[WebRTC] ontrack event fired! Track kind: ${event.track.kind}, Streams length: ${event.streams?.length}`);
      
      const stream = event.streams && event.streams[0];
      
      setRemoteStreams(prev => {
        if (!stream) {
          console.log(`[WebRTC] Fallback: No event.streams[0], using manual MediaStream.`);
          if (prev[targetId]) {
            prev[targetId].addTrack(event.track);
            // Trigger a re-render by returning a new object reference
            return { ...prev };
          }
          return { ...prev, [targetId]: new MediaStream([event.track]) };
        }
        
        console.log(`[WebRTC] Setting remote stream directly from event.streams[0].`);
        // Use the exact stream object provided by the browser
        return { ...prev, [targetId]: stream };
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[WebRTC] Generated ICE candidate: ${event.candidate.candidate.split(' ')[7]} (type)`);
        sendSignalingMessage('ice_candidate', { target_id: targetId, candidate: event.candidate });
      } else {
        console.log(`[WebRTC] ICE candidate gathering complete.`);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state changed to: ${pc.connectionState}`);
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
      console.log(`[WebRTC] ICE Connection state changed to: ${pc.iceConnectionState}`);
    };

    return pc;
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
        console.log(`[WebRTC] Creating offer for: ${sender_id}`);
        const pc = initPeerConnection(sender_id, localStreamRef.current);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log(`[WebRTC] Offer created and set as local description. Sending offer.`);
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
      console.log(`[WebRTC] Answer created and set as local description. Sending answer.`);
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
