import { useState, useRef } from 'react';
import { getLiveKitToken } from '../services/api';

export function useLiveKitCall(
  sendSignalingMessage: (event: string, payload: any) => void
) {
  const [callStatus, _setCallStatus] = useState<'idle' | 'calling' | 'ringing' | 'connected'>('idle');
  const callStatusRef = useRef<'idle' | 'calling' | 'ringing' | 'connected'>('idle');
  const setCallStatus = (status: 'idle' | 'calling' | 'ringing' | 'connected') => {
    callStatusRef.current = status;
    _setCallStatus(status);
  };

  const [callType, setCallType] = useState<'video' | 'audio'>('video');
  const [roomName, setRoomName] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const [incomingCallData, _setIncomingCallData] = useState<{ caller_id: string, caller_name: string, type: 'video' | 'audio', roomName: string } | null>(null);
  const incomingCallDataRef = useRef<{ caller_id: string, caller_name: string, type: 'video' | 'audio', roomName: string } | null>(null);
  const setIncomingCallData = (data: { caller_id: string, caller_name: string, type: 'video' | 'audio', roomName: string } | null) => {
    incomingCallDataRef.current = data;
    _setIncomingCallData(data);
  };

  const initiateCall = async (targetId: string, _targetName: string, type: 'video' | 'audio', myId: string, myName: string) => {
    if (callStatusRef.current !== 'idle') return;

    console.log(`[LiveKit] Initiating ${type} call to ${targetId}`);
    setCallType(type);
    setCallStatus('calling');
    setIsAudioMuted(false);
    setIsVideoOff(type === 'audio');

    const generatedRoomName = `room_${myId}_${targetId}_${Date.now()}`;
    setRoomName(generatedRoomName);

    try {
      const res = await getLiveKitToken(generatedRoomName, myName);
      if (res.token) {
        setToken(res.token);
        // Alert the receiver
        sendSignalingMessage('livekit_offer', { 
          target_id: targetId, 
          caller_id: myId,
          caller_name: myName, 
          type, 
          roomName: generatedRoomName 
        });
      }
    } catch (e) {
      console.error('[LiveKit] Error getting token for initiation', e);
      cleanup();
    }
  };

  const acceptCall = async (myName: string) => {
    if (!incomingCallDataRef.current) return;
    
    console.log(`[LiveKit] Accepting call from ${incomingCallDataRef.current.caller_id}`);
    const { roomName, type, caller_id } = incomingCallDataRef.current;
    
    setCallType(type);
    setRoomName(roomName);
    setIsAudioMuted(false);
    setIsVideoOff(type === 'audio');
    
    try {
      const res = await getLiveKitToken(roomName, myName);
      if (res.token) {
        setToken(res.token);
        setCallStatus('connected');
        // Tell caller we joined
        sendSignalingMessage('livekit_answer', { target_id: caller_id });
        setIncomingCallData(null);
      }
    } catch (e) {
      console.error('[LiveKit] Error getting token for accept', e);
      cleanup();
    }
  };

  const rejectCall = () => {
    if (incomingCallDataRef.current) {
      sendSignalingMessage('livekit_reject', { target_id: incomingCallDataRef.current.caller_id });
    }
    cleanup();
  };

  const endCall = (targetId?: string) => {
    if (targetId) {
       sendSignalingMessage('livekit_end', { target_id: targetId });
    }
    cleanup();
  };

  const cleanup = () => {
    setCallStatus('idle');
    setIncomingCallData(null);
    setRoomName(null);
    setToken(null);
    setIsAudioMuted(false);
    setIsVideoOff(false);
  };

  // --- Handlers for incoming signaling events ---

  const handleReceiveOffer = (payload: any) => {
    if (callStatusRef.current !== 'idle') return; // Already in a call
    console.log(`[LiveKit] Ringing from ${payload.caller_id}`);
    
    setCallType(payload.type);
    setIncomingCallData({
      caller_id: payload.caller_id,
      caller_name: payload.caller_name,
      type: payload.type,
      roomName: payload.roomName
    });
    setCallStatus('ringing');
  };

  const handleReceiveAnswer = (payload: any) => {
    if (callStatusRef.current === 'calling') {
      console.log(`[LiveKit] Call answered by ${payload.sender_id}`);
      setCallStatus('connected');
    }
  };

  const handleReceiveReject = (payload: any) => {
    if (callStatusRef.current === 'calling') {
      console.log(`[LiveKit] Call rejected by ${payload.sender_id}`);
      cleanup();
    }
  };

  const handleReceiveEnd = (payload: any) => {
    if (callStatusRef.current !== 'idle') {
      console.log(`[LiveKit] Call ended by ${payload.sender_id}`);
      cleanup();
    }
  };

  return {
    callStatus,
    callType,
    incomingCallData,
    roomName,
    token,
    isAudioMuted,
    isVideoOff,
    setIsAudioMuted,
    setIsVideoOff,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    handleReceiveOffer,
    handleReceiveAnswer,
    handleReceiveReject,
    handleReceiveEnd,
    cleanup
  };
}
