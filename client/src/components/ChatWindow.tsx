import { useState, useEffect, useRef } from 'react';
import { getMessages, sendMessage, markAsRead, reactToMessage, pinMessage, unsendMessage, deleteForMe, logCall } from '../services/api';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Send, Check, CheckCheck, Paperclip, Video, Phone, Reply, Pin, Trash2, Smile, X, Forward, ArrowLeft, Mic, Square, User } from 'lucide-react';
import { useWebRTC } from '../hooks/useWebRTC';
import { useNotifications } from '../hooks/useNotifications';
import { loadPrivateKey, decryptSymmetricKey, decryptMessageText, generateSymmetricKey, importPublicKey, encryptSymmetricKey, encryptMessageText } from '../lib/crypto';
import CallModal from './CallModal';
import UserProfile from './UserProfile';
import Lightbox from './Lightbox';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import GroupProfileModal from './GroupProfileModal';

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🙏', '💯'];

export default function ChatWindow({ chat, onBack }: { chat: any, onBack?: () => void }) {
  const { profile, blockedUsers, contacts } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [reactionMenuId, setReactionMenuId] = useState<string | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  
  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  
  const [viewUserProfileId, setViewUserProfileId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Swipe to reply states
  const [swipedMsgId, setSwipedMsgId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const [showGroupModal, setShowGroupModal] = useState(false);

  
  const getDisplayName = (userId: string, defaultName: string) => {
    const contact = contacts.find(c => c.contact_id === userId);
    return contact?.custom_nickname || defaultName;
  };
  
  const getChatName = () => {
    if (chat.is_group) return chat.name;
    const otherMember = chat.members?.find((m: any) => m.user_id !== profile?.id);
    if (otherMember) {
      return getDisplayName(otherMember.user_id, chat.name);
    }
    return chat.name;
  };

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);


  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);
  
  const typingTimeoutRef = useRef<number | null>(null);
  const channelRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notifications = useNotifications();

  const webrtc = useWebRTC((event, payload) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event,
        payload: { ...payload, sender_id: profile?.id, caller_name: profile?.username }
      });
    }
  }, async (callData) => {
    // Only caller logs the call
    const receiverId = chat.members?.find((m: any) => m.user_id !== profile?.id)?.user_id;
    if (receiverId && !chat.is_group) {
      try {
        await logCall({
          receiver_id: receiverId,
          chat_id: chat.id,
          call_type: callData.type,
          status: callData.status,
          duration: callData.duration
        });

        // Send a message in the chat
        let content = '';
        if (callData.status === 'answered' || callData.duration > 0) {
          const mins = Math.floor(callData.duration / 60);
          const secs = callData.duration % 60;
          content = `📞 ${callData.type === 'video' ? 'Video' : 'Audio'} Call Ended (${mins}:${secs.toString().padStart(2, '0')})`;
        } else {
          content = `📵 Missed ${callData.type === 'video' ? 'Video' : 'Audio'} Call`;
        }
        
        sendMessage(chat.id, content).catch(console.error);
      } catch (err) {
        console.error('Failed to log call', err);
      }
    }
  });

  useEffect(() => {
    if (webrtc.callStatus === 'ringing') {
      notifications.startRing();
    } else {
      notifications.stopRing();
    }
  }, [webrtc.callStatus]);

  useEffect(() => {
    if (chat) {
      setPage(1);
      setHasMore(true);
      setReplyTo(null);
      loadMessages(1);
      markAsRead(chat.id).catch(console.error);

      const channel = supabase.channel(`chat_${chat.id}`);
      channelRef.current = channel;

      channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chat.id}` }, async (payload) => {
          let newMsg = payload.new;
          if (newMsg.content && newMsg.content.startsWith('E2EE:')) {
            const privKey = await loadPrivateKey(profile?.id);
            try {
              const parsed = JSON.parse(newMsg.content.slice(5));
              if (privKey && parsed.keys && parsed.keys[profile?.id]) {
                const symKey = await decryptSymmetricKey(parsed.keys[profile?.id], privKey);
                newMsg.content = await decryptMessageText(parsed.ciphertext, parsed.iv, symKey);
              } else {
                newMsg.content = "🔒 [Encrypted Message]";
              }
            } catch (err) {
               newMsg.content = "🔒 [Decryption Failed]";
            }
          }

          setMessages(prev => {
            if (prev.find(m => m.id === newMsg.id)) return prev;
            if (newMsg.sender_id !== profile?.id) {
              markAsRead(chat.id).catch(console.error);
            }
            return [...prev, newMsg];
          });
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chat.id}` }, (payload) => {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reads', filter: `chat_id=eq.${chat.id}` }, (payload) => {
          setMessages(prev => prev.map(m => {
            if (m.id === payload.new.message_id) {
              const currentReads = m.message_reads || [];
              if (!currentReads.some((r: any) => r.user_id === payload.new.user_id)) {
                return { ...m, message_reads: [...currentReads, payload.new] };
              }
            }
            return m;
          }));
        })
        .on('broadcast', { event: 'typing' }, (payload) => {
          if (payload.payload.user_id !== profile?.id) {
            if (payload.payload.isTyping) {
              setTypingUsers(prev => Array.from(new Set([...prev, payload.payload.username])));
            } else {
              setTypingUsers(prev => prev.filter(u => u !== payload.payload.username));
            }
          }
        })
        .on('broadcast', { event: 'peer_join' }, (payload) => {
          if (payload.payload.sender_id !== profile?.id) {
            webrtc.handlePeerJoin(payload.payload.sender_id, payload.payload.caller_name, payload.payload.type, payload.payload.is_group);
            if (document.visibilityState === 'hidden') {
              notifications.notify(`Incoming ${payload.payload.type} call`, { body: `${payload.payload.caller_name} started a call` });
            }
          }
        })
        .on('broadcast', { event: 'call_offer' }, (payload) => {
          if (payload.payload.target_id === profile?.id) {
            webrtc.handleReceiveOffer(payload.payload.offer, payload.payload.sender_id);
          }
        })
        .on('broadcast', { event: 'call_answer' }, (payload) => {
          if (payload.payload.target_id === profile?.id) {
            webrtc.handleReceiveAnswer(payload.payload.answer, payload.payload.sender_id);
          }
        })
        .on('broadcast', { event: 'ice_candidate' }, (payload) => {
          if (payload.payload.target_id === profile?.id) {
            webrtc.handleReceiveIceCandidate(payload.payload.candidate, payload.payload.sender_id);
          }
        })
        .on('broadcast', { event: 'peer_leave' }, (payload) => {
          if (payload.payload.sender_id !== profile?.id) {
            webrtc.handlePeerLeave(payload.payload.sender_id, chat.is_group);
          }
        })
        .subscribe();
        
      return () => {
        webrtc.cleanup();
        supabase.removeChannel(channel);
        channelRef.current = null;
        setTypingUsers([]);
      };
    }
  }, [chat]);

  useEffect(() => {
    if (page === 1) {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    } else if (scrollContainerRef.current) {
      const newScrollHeight = scrollContainerRef.current.scrollHeight;
      scrollContainerRef.current.scrollTop = newScrollHeight - prevScrollHeightRef.current;
    }
  }, [messages, typingUsers, page]);

  const loadMessages = async (pageNum: number) => {
    try {
      setLoadingMore(true);
      const res = await getMessages(chat.id, pageNum);
      
      const privKey = await loadPrivateKey(profile?.id);
      for (const msg of res) {
        if (msg.content && msg.content.startsWith('E2EE:')) {
          try {
            const parsed = JSON.parse(msg.content.slice(5));
            if (privKey && parsed.keys && parsed.keys[profile?.id]) {
              const symKey = await decryptSymmetricKey(parsed.keys[profile?.id], privKey);
              msg.content = await decryptMessageText(parsed.ciphertext, parsed.iv, symKey);
            } else {
              msg.content = "🔒 [Encrypted Message]";
            }
          } catch (err) {
             msg.content = "🔒 [Decryption Failed]";
          }
        }
      }

      const newMsgs = [...res].reverse();
      
      if (res.length < 50) setHasMore(false);

      if (pageNum === 1) {
        setMessages(newMsgs);
      } else {
        if (scrollContainerRef.current) {
          prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
        }
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const uniqueNew = newMsgs.filter(m => !existingIds.has(m.id));
          return [...uniqueNew, ...prev];
        });
      }
    } catch (e) { 
      console.error(e); 
    } finally {
      setLoadingMore(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop === 0 && hasMore && !loadingMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadMessages(nextPage);
    }
  };

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const scrollPos = el.offsetTop - container.offsetTop - (container.clientHeight / 2) + (el.clientHeight / 2);
      container.scrollTo({ top: scrollPos, behavior: 'smooth' });
      
      el.style.transition = 'background-color 0.5s';
      setHighlightedMsgId(msgId);
      setTimeout(() => setHighlightedMsgId(null), 2000);
    } else {
      alert("Message is too far back in history. Please scroll up to load more messages.");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { user_id: profile?.id, username: profile?.username, isTyping: true }
      });
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = window.setTimeout(() => {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'typing',
          payload: { user_id: profile?.id, username: profile?.username, isTyping: false }
        });
      }, 2000);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${chat.id}/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage.from('chat-media').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('chat-media').getPublicUrl(filePath);
      const mediaUrl = data.publicUrl;

      await sendMessage(chat.id, input || 'Sent a file', mediaUrl, file.type, replyTo?.id);
      setInput('');
      setReplyTo(null);
    } catch (err) {
      console.error('Upload failed', err);
      alert('Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recordingStreamRef.current = stream;
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          if (recordingStreamRef.current) {
            recordingStreamRef.current.getTracks().forEach(track => track.stop());
          }
          
          if (audioBlob.size > 100) {
            await uploadAndSendAudio(audioBlob);
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error('Failed to start recording', err);
        alert('Microphone access denied or not available');
      }
    }
  };

  const uploadAndSendAudio = async (audioBlob: Blob) => {
    setUploading(true);
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.webm`;
    const filePath = `${chat.id}/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage.from('chat-media').upload(filePath, audioBlob);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('chat-media').getPublicUrl(filePath);
      const mediaUrl = data.publicUrl;

      await sendMessage(chat.id, 'Voice message', mediaUrl, 'audio/webm', replyTo?.id);
      setReplyTo(null);
    } catch (err) {
      console.error('Audio upload failed', err);
      alert('Failed to send voice message');
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const content = input.trim();
    const currentReplyId = replyTo?.id;
    
    setInput('');
    setReplyTo(null);
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: profile?.id, username: profile?.username, isTyping: false }
    });
    
    try {
      let finalContent = content;
      
      const symKey = await generateSymmetricKey();
      const { ciphertext, iv } = await encryptMessageText(content, symKey);
      
      const keys: Record<string, string> = {};
      for (const member of chat.members) {
        if (member.user?.public_key) {
          const pubKey = await importPublicKey(member.user.public_key);
          const encSym = await encryptSymmetricKey(symKey, pubKey);
          keys[member.user_id] = encSym;
        }
      }
      
      if (Object.keys(keys).length > 0) {
        finalContent = 'E2EE:' + JSON.stringify({ ciphertext, iv, keys });
      }

      await sendMessage(chat.id, finalContent, undefined, undefined, currentReplyId);
      loadMessages(1);
    } catch (e) {
      console.error(e);
      alert('Failed to send encrypted message. E2EE keys might be missing for some users.');
    }
  };

  const handleAction = async (action: string, msg: any) => {
    try {
      if (action === 'reply') {
        setReplyTo(msg);
      } else if (action === 'deleteForMe') {
        await deleteForMe(chat.id, msg.id);
        setMessages(prev => prev.filter(m => m.id !== msg.id));
      } else if (action === 'unsend') {
        if (confirm('Are you sure you want to unsend this message?')) {
          await unsendMessage(chat.id, msg.id);
        }
      } else if (action === 'pin') {
        await pinMessage(chat.id, msg.id);
      } else if (action === 'forward') {
        alert('Forward feature coming soon! (Modal UI needed)');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReaction = async (msgId: string, emoji: string) => {
    setReactionMenuId(null);
    try {
      await reactToMessage(chat.id, msgId, emoji);
    } catch (err) {
      console.error(err);
    }
  };

  if (!chat) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Select a chat to start messaging</div>;
  }

  const pinnedMessages = messages.filter(m => m.is_pinned && !m.is_deleted && !m.deleted_for?.includes(profile?.id));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'transparent', position: 'relative' }}>
      <CallModal
        localStream={webrtc.localStream}
        remoteStreams={webrtc.remoteStreams}
        callStatus={webrtc.callStatus}
        callType={webrtc.callType}
        incomingCallData={webrtc.incomingCallData}
        isMuted={webrtc.isMuted}
        isVideoOff={webrtc.isVideoOff}
        onToggleAudio={webrtc.toggleAudio}
        onToggleVideo={webrtc.toggleVideo}
        onAccept={() => webrtc.acceptCall()}
        onDecline={() => webrtc.cleanup()}
        onEndCall={() => webrtc.endCall()}
      />
      
      {viewUserProfileId && <UserProfile userId={viewUserProfileId} chatId={chat.id} onClose={() => setViewUserProfileId(null)} />}
      
      {showGroupModal && (
        <GroupProfileModal 
          chat={chat} 
          onClose={() => setShowGroupModal(false)} 
          onUpdate={(updates?: any) => {
            if (updates) {
              Object.assign(chat, updates);

            }
            window.dispatchEvent(new Event('chat_updated')); 
          }} 
        />
      )}
      
      {/* Header */}
      <div 
        onClick={() => {
          if (chat.is_group) setShowGroupModal(true);
        }}
        style={{ 
          padding: '1rem 1.5rem', 
          backgroundColor: 'var(--bg-secondary)', 
          borderBottom: '1px solid var(--border-color)', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          zIndex: 10,
          cursor: chat.is_group ? 'pointer' : 'default',
          transition: 'background 0.2s',
          flexShrink: 0
        }}
        onMouseEnter={e => {
          if (chat.is_group) e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
        }}
        onMouseLeave={e => {
          if (chat.is_group) e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {onBack && (
            <button onClick={onBack} className="btn mobile-only" style={{ padding: '0.25rem', color: 'var(--text-secondary)' }}>
              <ArrowLeft size={20} />
            </button>
          )}
          
          {chat.avatar_url ? (
            <img 
              src={chat.avatar_url} 
              alt="avatar" 
              style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }} 
              onClick={() => {
                if (chat.is_group) {
                  setShowGroupModal(true);
                } else {
                  const otherUserId = chat.members?.find((m: any) => m.user_id !== profile?.id)?.user_id;
                  if (otherUserId) setViewUserProfileId(otherUserId);
                }
              }}
            />
          ) : (
            <div 
              style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}
              onClick={() => {
                if (chat.is_group) setShowGroupModal(true);
              }}
            >
              {getChatName().charAt(0).toUpperCase()}
            </div>
          )}
          <div 
            style={{ display: 'flex', flexDirection: 'column', cursor: chat.is_group ? 'default' : 'pointer' }}
            onClick={() => {
              if (!chat.is_group) {
                const otherUserId = chat.members?.find((m: any) => m.user_id !== profile?.id)?.user_id;
                if (otherUserId) setViewUserProfileId(otherUserId);
              }
            }}
          >
            <span style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>{getChatName()}</span>
            {/* Subtle Online Status could go here if we fetched it for the header */}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button onClick={() => webrtc.initiateCall(profile?.username || 'Unknown', 'audio', chat.is_group)} className="btn-icon" style={{ color: 'var(--accent-primary)' }}>
            <Phone size={20} />
          </button>
          <button onClick={() => webrtc.initiateCall(profile?.username || 'Unknown', 'video', chat.is_group)} className="btn-icon" style={{ color: 'var(--accent-primary)' }}>
            <Video size={20} />
          </button>
        </div>
      </div>
      
      {pinnedMessages.length > 0 && (
        <div 
          onClick={() => scrollToMessage(pinnedMessages[0].id)}
          style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', flexShrink: 0 }}
        >
          <Pin size={14} color="var(--accent-primary)" />
          <span style={{ fontWeight: 500, flex: 1 }} className="truncate">Pinned: {pinnedMessages[0].content || 'Media'}</span>
        </div>
      )}

      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', overscrollBehaviorY: 'none' }}
      >
        {loadingMore && <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading older messages...</div>}
        
        {(() => {
          // Calculate the latest read timestamp by anyone other than the current user
          let maxReadTimestamp = 0;
          messages.forEach(msg => {
            if (msg.message_reads && msg.message_reads.length > 0) {
              msg.message_reads.forEach((r: any) => {
                if (r.user_id !== profile?.id) {
                  const t = new Date(msg.created_at).getTime();
                  if (t > maxReadTimestamp) maxReadTimestamp = t;
                }
              });
            }
          });

          return messages.map((msg, i) => {
            if (msg.deleted_for?.includes(profile?.id)) return null;

            const isBlocked = blockedUsers.includes(msg.sender_id);
            if (isBlocked && chat.is_group) return null;

            const isMine = msg.sender_id === profile?.id;
            const isDeleted = msg.is_deleted;
            const msgTime = new Date(msg.created_at).getTime();
            const isSeen = msgTime <= maxReadTimestamp;

          
          return (
            <div key={msg.id || i} style={{ position: 'relative' }}>
              
              {/* Reply Icon Background (revealed on swipe) */}
              {swipedMsgId === msg.id && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  left: isMine ? 'auto' : `calc(${swipeOffset}px - 40px)`,
                  right: isMine ? `calc(${swipeOffset}px - 40px)` : 'auto',
                  opacity: Math.min(swipeOffset / 50, 1),
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-secondary)',
                  boxShadow: 'var(--shadow-sm)',
                  zIndex: 0
                }}>
                  <Reply size={16} />
                </div>
              )}

              <div 
                id={`msg-${msg.id}`}
                style={{ 
                  display: 'flex', 
                  justifyContent: isMine ? 'flex-end' : 'flex-start', 
                  position: 'relative',
                  transition: swipedMsgId === msg.id ? 'none' : 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), background-color 0.3s ease',
                  backgroundColor: highlightedMsgId === msg.id ? 'var(--accent-muted)' : 'transparent',
                  borderRadius: 'var(--radius-lg)',
                  transform: swipedMsgId === msg.id ? `translateX(${isMine ? -swipeOffset : swipeOffset}px)` : 'translateX(0)',
                  zIndex: 1
                }}
                onMouseEnter={() => setHoveredMsgId(msg.id)}
                onMouseLeave={() => setHoveredMsgId(null)}
                onClick={() => {
                  if (window.innerWidth <= 768) {
                    setHoveredMsgId(hoveredMsgId === msg.id ? null : msg.id);
                  }
                }}
                onTouchStart={(e) => {
                  touchStartX.current = e.touches[0].clientX;
                }}
                onTouchMove={(e) => {
                  if (touchStartX.current !== null) {
                    const diff = e.touches[0].clientX - touchStartX.current;
                    // Swipe right for others, swipe left for mine
                    const offset = isMine ? -diff : diff;
                    if (offset > 0 && offset < 100) { 
                      setSwipedMsgId(msg.id);
                      setSwipeOffset(offset);
                    }
                  }
                }}
                onTouchEnd={() => {
                  if (swipedMsgId === msg.id && swipeOffset > 50) {
                    handleAction('reply', msg);
                  }
                  setSwipedMsgId(null);
                  setSwipeOffset(0);
                  touchStartX.current = null;
                }}
              >
              {!isMine && (
                <div 
                  style={{ 
                    width: '28px', height: '28px', borderRadius: '50%', marginRight: '0.5rem', 
                    alignSelf: 'flex-end', cursor: 'pointer', marginBottom: '0.25rem',
                    backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewUserProfileId(msg.sender_id);
                  }}
                >
                  {msg.sender?.avatar_url ? (
                    <img src={msg.sender.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <User size={16} />
                  )}
                </div>
              )}

              {/* Context Menu / Action Bar */}
              {hoveredMsgId === msg.id && !isDeleted && (
                <div style={{ 
                  position: 'absolute', 
                  top: '-15px', 
                  [isMine ? 'right' : 'left']: '10px', 
                  backgroundColor: 'var(--bg-secondary)', 
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  gap: '0.25rem',
                  padding: '0.25rem',
                  zIndex: 10,
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                }}>
                  <button className="btn" title="React" onClick={() => setReactionMenuId(reactionMenuId === msg.id ? null : msg.id)} style={{ padding: '0.25rem' }}><Smile size={14} /></button>
                  <button className="btn" title="Reply" onClick={() => handleAction('reply', msg)} style={{ padding: '0.25rem' }}><Reply size={14} /></button>
                  <button className="btn" title="Forward" onClick={() => handleAction('forward', msg)} style={{ padding: '0.25rem' }}><Forward size={14} /></button>
                  <button className="btn" title="Pin" onClick={() => handleAction('pin', msg)} style={{ padding: '0.25rem' }}><Pin size={14} /></button>
                  <button className="btn" title="Delete for me" onClick={() => handleAction('deleteForMe', msg)} style={{ padding: '0.25rem' }}><Trash2 size={14} /></button>
                  {isMine && <button className="btn" title="Unsend (Everyone)" onClick={() => handleAction('unsend', msg)} style={{ padding: '0.25rem', color: 'var(--danger)' }}><X size={14} /></button>}
                </div>
              )}

              {/* Emoji Picker Popup */}
              {reactionMenuId === msg.id && !isDeleted && (
                <div style={{ 
                  position: 'absolute', 
                  top: '-45px', 
                  [isMine ? 'right' : 'left']: '10px', 
                  backgroundColor: 'var(--bg-secondary)', 
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  padding: '0.5rem',
                  zIndex: 11,
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                }}>
                  {EMOJIS.map(emoji => (
                    <span key={emoji} style={{ cursor: 'pointer', padding: '0 0.25rem', fontSize: '1.25rem' }} onClick={() => handleReaction(msg.id, emoji)}>
                      {emoji}
                    </span>
                  ))}
                </div>
              )}

              <div style={{ 
                maxWidth: 'clamp(200px, 85%, 600px)', 
                display: 'flex',
                flexDirection: 'column',
                alignItems: isMine ? 'flex-end' : 'flex-start'
              }}>
                <div style={{ 
                  padding: msg.media_url ? '0.35rem' : '0.65rem 1rem', 
                  borderRadius: '1.25rem', 
                  backgroundColor: isDeleted ? 'transparent' : (isMine ? 'var(--accent-primary)' : 'var(--bg-elevated)'),
                  color: isDeleted ? 'var(--text-secondary)' : (isMine ? 'var(--text-inverse)' : 'var(--text-primary)'),
                  border: isDeleted ? '1px solid var(--border-color)' : '1px solid var(--border-light)',
                  boxShadow: isDeleted ? 'none' : 'var(--shadow-sm)',
                  borderBottomRightRadius: isMine ? '0.25rem' : '1.25rem',
                  borderBottomLeftRadius: !isMine ? '0.25rem' : '1.25rem',
                  fontStyle: isDeleted ? 'italic' : 'normal',
                  position: 'relative'
                }}>
                  
                  {/* Reply Reference Bubble */}
                  {!isDeleted && msg.reply_to_id && msg.reply_to && (
                    <div 
                      onClick={() => scrollToMessage(msg.reply_to_id)}
                      style={{ 
                        backgroundColor: 'rgba(0,0,0,0.1)', 
                        padding: '0.5rem', 
                        borderRadius: 'var(--radius-sm)', 
                        marginBottom: '0.5rem',
                        fontSize: '0.75rem',
                        borderLeft: '3px solid rgba(255,255,255,0.5)',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{msg.reply_to.sender?.username}</div>
                      <div>{msg.reply_to.is_deleted ? 'Message unsent' : (msg.reply_to.content || 'Media')}</div>
                    </div>
                  )}

                  {isDeleted ? (
                    <div>This message was unsent</div>
                  ) : (
                    <>
                      {msg.media_url && (
                        <div style={{ marginBottom: '0.5rem' }}>
                          {msg.media_type?.startsWith('image/') ? (
                            <img 
                              src={msg.media_url} 
                              alt="media" 
                              style={{ maxWidth: '280px', maxHeight: '350px', width: '100%', height: 'auto', objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)', display: 'block', cursor: 'pointer' }} 
                              onClick={() => setLightboxImage(msg.media_url)}
                            />
                          ) : msg.media_type?.startsWith('audio/') ? (
                            <audio src={msg.media_url} controls style={{ maxWidth: '250px', outline: 'none' }} />
                          ) : (
                            <a href={msg.media_url} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>View Attachment</a>
                          )}
                        </div>
                      )}
                      {(msg.content && !(msg.media_type?.startsWith('audio/') && msg.content === 'Voice message')) && (
                        <div style={{ padding: msg.media_url ? '0 0.5rem 0.25rem 0.5rem' : '0', fontSize: '0.95rem' }}>
                          {msg.content}
                        </div>
                      )}
                      {!isMine && chat.is_group && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', marginBottom: '0.25rem', fontWeight: 600, padding: msg.media_url ? '0 0.5rem' : '0' }}>
                          {getDisplayName(msg.sender_id, msg.sender?.username)}
                        </div>
                      )}
                    </>
                  )}

                  {/* Timestamp & Status */}
                  {!isDeleted && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '0.65rem', color: isMine ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)' }}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {isMine && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                          {isSeen ? (
                            <>
                              <CheckCheck size={14} strokeWidth={2.5} color="#47bfff" />
                              <span style={{ fontSize: '0.6rem', opacity: 0.8 }}>seen</span>
                            </>
                          ) : (
                            <Check size={12} strokeWidth={3} />
                          )}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Reactions Display */}
                {!isDeleted && msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div style={{ display: 'flex', gap: '0.25rem', marginTop: '-0.5rem', zIndex: 1, marginLeft: isMine ? 0 : '0.5rem', marginRight: isMine ? '0.5rem' : 0 }}>
                    {Object.entries(msg.reactions).map(([emoji, users]: [string, any]) => (
                      <div 
                        key={emoji} 
                        onClick={() => handleReaction(msg.id, emoji)}
                        style={{ 
                          backgroundColor: 'var(--bg-secondary)', 
                          border: '1px solid var(--border-color)', 
                          borderRadius: '1rem', 
                          padding: '0.1rem 0.4rem', 
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          color: users.includes(profile?.id) ? 'var(--accent-primary)' : 'inherit'
                        }}
                      >
                        {emoji} <span style={{ opacity: 0.7 }}>{users.length}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          );
        })}
        {typingUsers.length > 0 && (
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            {typingUsers.join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} typing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ backgroundColor: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', zIndex: 10, flexShrink: 0 }}>
        {/* Reply Indicator Bar */}
        {replyTo && (
          <div style={{ padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-tertiary)' }}>
            <div style={{ fontSize: '0.85rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>Replying to {replyTo.sender?.username || 'user'}</span>
              <div style={{ color: 'var(--text-secondary)' }} className="truncate">{replyTo.content || 'Media'}</div>
            </div>
            <button className="btn-icon" onClick={() => setReplyTo(null)}>
              <X size={16} />
            </button>
          </div>
        )}
        
        {/* Emoji Picker Popup */}
        {showEmojiPicker && (
          <div style={{ position: 'absolute', bottom: '80px', right: '20px', zIndex: 100 }}>
            <EmojiPicker 
              onEmojiClick={(emojiData) => {
                setInput(prev => prev + emojiData.emoji);
                setShowEmojiPicker(false);
              }}
              theme={document.documentElement.getAttribute('data-theme') === 'dark' ? Theme.DARK : Theme.LIGHT}
              lazyLoadEmojis={true}
            />
          </div>
        )}
        
        <div style={{ padding: '1rem 1.5rem' }}>
          <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center', 
              backgroundColor: 'var(--bg-tertiary)', 
              borderRadius: '1.5rem', 
              padding: '0.25rem 0.5rem',
              border: '1px solid transparent',
              transition: 'border 0.2s'
            }}>
              <button type="button" className="btn-icon" onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ padding: '0.25rem' }}>
                <Paperclip size={20} />
              </button>
              <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
              
              <input 
                type="text" 
                placeholder={uploading ? 'Uploading...' : 'Type a message...'} 
                value={input}
                onChange={handleInputChange}
                style={{ 
                  flex: 1, 
                  backgroundColor: 'transparent', 
                  border: 'none', 
                  padding: 'clamp(0.5rem, 2vw, 0.75rem) 0.5rem', 
                  color: 'var(--text-primary)', 
                  outline: 'none',
                  fontSize: 'clamp(0.85rem, 1.5vw, 0.95rem)',
                  minWidth: 0
                }}
                disabled={uploading}
              />
              <button 
                type="button" 
                className="btn-icon" 
                disabled={uploading} 
                style={{ padding: '0.25rem' }}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <Smile size={20} color={showEmojiPicker ? 'var(--accent-primary)' : 'inherit'} />
              </button>
            </div>

            {input.trim() ? (
              <button type="submit" className="btn-primary" style={{ width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: 'none', cursor: 'pointer' }} disabled={uploading}>
                <Send size={20} style={{ marginLeft: '2px' }} />
              </button>
            ) : (
              <button 
                type="button" 
                className="btn-primary" 
                style={{ 
                  width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: 'none', cursor: 'pointer',
                  backgroundColor: isRecording ? 'var(--danger)' : 'var(--accent-primary)', 
                  animation: isRecording ? 'pulse-skeleton 1.5s infinite' : 'none' 
                }} 
                disabled={uploading}
                onClick={toggleRecording}
              >
                {isRecording ? <Square size={20} /> : <Mic size={20} />}
              </button>
            )}
          </form>
        </div>
      </div>
      
      {lightboxImage && (
        <Lightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />
      )}
    </div>
  );
}
