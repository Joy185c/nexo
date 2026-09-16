import { useState, useRef, useCallback } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export function useWebRTC(
  sendSignalingMessage: (event: string, payload: any) => void
) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'ringing' | 'connected'>('idle');
  const [callType, setCallType] = useState<'video' | 'audio'>('video');
  const [incomingCallData, setIncomingCallData] = useState<{ caller_id: string, caller_name: string, offer?: RTCSessionDescriptionInit, type: 'video' | 'audio' } | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

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

  const initPeerConnection = useCallback((stream: MediaStream) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignalingMessage('ice_candidate', { candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        endCall();
      }
    };

    return pc;
  }, [sendSignalingMessage]);

  const initiateCall = async (callerName: string, type: 'video' | 'audio' = 'video') => {
    try {
      setCallType(type);
      const stream = await startLocalStream(type);
      const pc = initPeerConnection(stream);
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      sendSignalingMessage('call_offer', { offer, caller_name: callerName, type });
      setCallStatus('calling');
    } catch (err) {
      console.error('Failed to initiate call', err);
      endCall();
    }
  };

  const handleReceiveOffer = async (offer: RTCSessionDescriptionInit, caller_id: string, caller_name: string, type: 'video' | 'audio' = 'video') => {
    if (callStatus !== 'idle') return; // Busy
    setCallType(type);
    setIncomingCallData({ caller_id, caller_name, offer, type });
    setCallStatus('ringing');
  };

  const acceptCall = async (offer: RTCSessionDescriptionInit) => {
    try {
      const type = incomingCallData?.type || 'video';
      const stream = await startLocalStream(type);
      const pc = initPeerConnection(stream);
      
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      sendSignalingMessage('call_answer', { answer });
      setCallStatus('connected');
      setIncomingCallData(null);
    } catch (err) {
      console.error('Failed to accept call', err);
      endCall();
    }
  };

  const handleReceiveAnswer = async (answer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      setCallStatus('connected');
    } catch (e) {
      console.error('Failed to set remote description on answer', e);
    }
  };

  const handleReceiveIceCandidate = async (candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error('Error adding ICE candidate', e);
    }
  };

  const endCall = () => {
    sendSignalingMessage('call_end', {});
    cleanup();
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const cleanup = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);
    setCallStatus('idle');
    setIncomingCallData(null);
    setIsMuted(false);
    setIsVideoOff(false);
  };

  return {
    localStream,
    remoteStream,
    callStatus,
    callType,
    incomingCallData,
    isMuted,
    isVideoOff,
    initiateCall,
    acceptCall,
    handleReceiveOffer,
    handleReceiveAnswer,
    handleReceiveIceCandidate,
    endCall,
    cleanup,
    toggleAudio,
    toggleVideo
  };
}
