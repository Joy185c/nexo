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
      const stream = await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true });
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('Error accessing media devices.', err);
      throw err;
    }
  };

  const initPeerConnection = (targetId: string, stream: MediaStream) => {
    if (peerConnectionsRef.current[targetId]) {
      peerConnectionsRef.current[targetId].close();
    }
    
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current[targetId] = pc;

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      setRemoteStreams(prev => {
        const stream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);
        if (prev[targetId]) {
          // Create a new stream to ensure React triggers re-render and re-assigns srcObject
          const newStream = new MediaStream(prev[targetId].getTracks());
          if (!newStream.getTracks().find(t => t.id === event.track.id)) {
             newStream.addTrack(event.track);
          }
          return { ...prev, [targetId]: newStream };
        }
        return { ...prev, [targetId]: stream };
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignalingMessage('ice_candidate', { target_id: targetId, candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        setRemoteStreams(prev => {
          const next = { ...prev };
          delete next[targetId];
          return next;
        });
        delete peerConnectionsRef.current[targetId];
        
        // If no more connections, end call
        if (Object.keys(peerConnectionsRef.current).length === 0 && callStatusRef.current === 'connected') {
          endCall();
        }
      }
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

  const handlePeerJoin = async (sender_id: string, caller_name: string, type: 'video' | 'audio', is_group: boolean) => {
    if (callStatusRef.current === 'idle') {
      // Prompt user to join
      setCallType(type);
      setIncomingCallData({ caller_id: sender_id, caller_name, type, is_group });
      setCallStatus('ringing');
    } else if ((callStatusRef.current === 'connected' || callStatusRef.current === 'calling') && localStreamRef.current) {
      if (callStatusRef.current === 'calling') {
        setCallStatus('connected');
      }
      // We are already in the call, someone new joined!
      // We must create an offer for them.
      const pc = initPeerConnection(sender_id, localStreamRef.current);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignalingMessage('call_offer', { target_id: sender_id, offer, type });
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
    if (callStatusRef.current !== 'connected' || !localStreamRef.current) return;
    try {
      const pc = initPeerConnection(sender_id, localStreamRef.current);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      // Process queued ICE candidates
      if (iceCandidateQueueRef.current[sender_id]) {
        for (const candidate of iceCandidateQueueRef.current[sender_id]) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error('Queued ICE error:', e));
        }
        delete iceCandidateQueueRef.current[sender_id];
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignalingMessage('call_answer', { target_id: sender_id, answer });
    } catch (e) {
      console.error('Failed to handle offer', e);
    }
  };

  // 5. Existing user receives answer from new user
  const handleReceiveAnswer = async (answer: RTCSessionDescriptionInit, sender_id: string) => {
    const pc = peerConnectionsRef.current[sender_id];
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      
      // Process queued ICE candidates
      if (iceCandidateQueueRef.current[sender_id]) {
        for (const candidate of iceCandidateQueueRef.current[sender_id]) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error('Queued ICE error:', e));
        }
        delete iceCandidateQueueRef.current[sender_id];
      }

      if (!callStartTimeRef.current) callStartTimeRef.current = Date.now();
    } catch (e) {
      console.error('Failed to set remote description on answer', e);
    }
  };

  // 6. ICE candidates exchange
  const handleReceiveIceCandidate = async (candidate: RTCIceCandidateInit, sender_id: string) => {
    const pc = peerConnectionsRef.current[sender_id];
    if (!pc || !pc.remoteDescription) {
      if (!iceCandidateQueueRef.current[sender_id]) {
        iceCandidateQueueRef.current[sender_id] = [];
      }
      iceCandidateQueueRef.current[sender_id].push(candidate);
      return;
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error('Error adding ICE candidate', e);
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
