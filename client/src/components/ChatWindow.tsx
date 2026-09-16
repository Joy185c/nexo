import { useState, useEffect, useRef } from 'react';
import { getMessages, sendMessage, markAsRead, reactToMessage, pinMessage, unsendMessage, deleteForMe } from '../services/api';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Send, Check, Paperclip, Video, Phone, Reply, Pin, Trash2, Smile, X, Forward, ArrowLeft } from 'lucide-react';
import { useWebRTC } from '../hooks/useWebRTC';
import { useNotifications } from '../hooks/useNotifications';
import CallModal from './CallModal';
import UserProfile from './UserProfile';
import Lightbox from './Lightbox';

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export default function ChatWindow({ chat, onBack }: { chat: any, onBack?: () => void }) {
  const { profile, blockedUsers, contacts } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [reactionMenuId, setReactionMenuId] = useState<string | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  
  const [viewUserProfileId, setViewUserProfileId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  
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
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chat.id}` }, (payload) => {
          setMessages(prev => {
            if (prev.find(m => m.id === payload.new.id)) return prev;
            if (payload.new.sender_id !== profile?.id) {
              markAsRead(chat.id).catch(console.error);
            }
            // Fetch nested reply_to info if needed? 
            // In a real app we'd fetch it, but for optimistic we can just append
            return [...prev, payload.new];
          });
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chat.id}` }, (payload) => {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
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
        .on('broadcast', { event: 'call_offer' }, (payload) => {
          if (payload.payload.sender_id !== profile?.id) {
            webrtc.handleReceiveOffer(payload.payload.offer, payload.payload.sender_id, payload.payload.caller_name, payload.payload.type);
            if (document.visibilityState === 'hidden') {
              notifications.notify(`Incoming ${payload.payload.type} call`, { body: `${payload.payload.caller_name} is calling you...` });
            }
          }
        })
        .on('broadcast', { event: 'call_answer' }, (payload) => {
          if (payload.payload.sender_id !== profile?.id) {
            webrtc.handleReceiveAnswer(payload.payload.answer);
          }
        })
        .on('broadcast', { event: 'ice_candidate' }, (payload) => {
          if (payload.payload.sender_id !== profile?.id) {
            webrtc.handleReceiveIceCandidate(payload.payload.candidate);
          }
        })
        .on('broadcast', { event: 'call_end' }, (payload) => {
          if (payload.payload.sender_id !== profile?.id) {
            webrtc.cleanup();
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
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (scrollContainerRef.current) {
      const newScrollHeight = scrollContainerRef.current.scrollHeight;
      scrollContainerRef.current.scrollTop = newScrollHeight - prevScrollHeightRef.current;
    }
  }, [messages, typingUsers, page]);

  const loadMessages = async (pageNum: number) => {
    try {
      setLoadingMore(true);
      const res = await getMessages(chat.id, pageNum);
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
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      await sendMessage(chat.id, content, undefined, undefined, currentReplyId);
      // We rely on realtime/postgres_changes to show it, or we could optimistic append
      // but reply_to nested info needs fetching. So we just reload page 1 to be safe
      loadMessages(1);
    } catch (e) {
      console.error(e);
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-primary)', position: 'relative' }}>
      <CallModal
        localStream={webrtc.localStream}
        remoteStream={webrtc.remoteStream}
        callStatus={webrtc.callStatus}
        callType={webrtc.callType}
        incomingCallData={webrtc.incomingCallData}
        isMuted={webrtc.isMuted}
        isVideoOff={webrtc.isVideoOff}
        onToggleAudio={webrtc.toggleAudio}
        onToggleVideo={webrtc.toggleVideo}
        onAccept={() => webrtc.incomingCallData?.offer && webrtc.acceptCall(webrtc.incomingCallData.offer)}
        onDecline={() => webrtc.cleanup()}
        onEndCall={() => webrtc.endCall()}
      />
      
      {viewUserProfileId && <UserProfile userId={viewUserProfileId} onClose={() => setViewUserProfileId(null)} />}
      
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {onBack && (
            <button onClick={onBack} className="btn mobile-only" style={{ padding: '0.25rem', color: 'var(--text-secondary)' }}>
              <ArrowLeft size={20} />
            </button>
          )}
          
          {!chat.is_group && chat.avatar_url && (
            <img 
              src={chat.avatar_url} 
              alt="avatar" 
              style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }} 
              onClick={() => {
                const otherUserId = chat.members?.find((m: any) => m.user_id !== profile?.id)?.user_id;
                if (otherUserId) setViewUserProfileId(otherUserId);
              }}
            />
          )}
          <span 
            style={{ cursor: chat.is_group ? 'default' : 'pointer' }}
            onClick={() => {
              if (!chat.is_group) {
                const otherUserId = chat.members?.find((m: any) => m.user_id !== profile?.id)?.user_id;
                if (otherUserId) setViewUserProfileId(otherUserId);
              }
            }}
          >
            {getChatName()}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => webrtc.initiateCall(profile?.username || 'Unknown', 'audio')} className="btn" style={{ padding: '0.25rem' }}>
            <Phone size={18} color="var(--accent-primary)" />
          </button>
          <button onClick={() => webrtc.initiateCall(profile?.username || 'Unknown', 'video')} className="btn" style={{ padding: '0.25rem' }}>
            <Video size={18} color="var(--accent-primary)" />
          </button>
        </div>
      </div>
      
      {pinnedMessages.length > 0 && (
        <div 
          onClick={() => scrollToMessage(pinnedMessages[0].id)}
          style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
        >
          <Pin size={14} color="var(--accent-primary)" />
          <span style={{ fontWeight: 500, flex: 1 }} className="truncate">Pinned: {pinnedMessages[0].content || 'Media'}</span>
        </div>
      )}

      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        {loadingMore && <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading older messages...</div>}
        
        {messages.map((msg, i) => {
          if (msg.deleted_for?.includes(profile?.id)) return null;

          const isBlocked = blockedUsers.includes(msg.sender_id);
          if (isBlocked && chat.is_group) return null;

          const isMine = msg.sender_id === profile?.id;
          const isDeleted = msg.is_deleted;
          
          return (
            <div 
              key={msg.id || i} 
              id={`msg-${msg.id}`}
              style={{ 
                display: 'flex', 
                justifyContent: isMine ? 'flex-end' : 'flex-start', 
                position: 'relative',
                transition: 'background-color 0.3s ease',
                backgroundColor: highlightedMsgId === msg.id ? 'rgba(var(--accent-primary-rgb), 0.1)' : 'transparent',
                borderRadius: 'var(--radius-lg)'
              }}
              onMouseEnter={() => setHoveredMsgId(msg.id)}
              onMouseLeave={() => setHoveredMsgId(null)}
              onClick={() => {
                if (window.innerWidth <= 768) {
                  setHoveredMsgId(hoveredMsgId === msg.id ? null : msg.id);
                }
              }}
            >
              {!isMine && msg.sender?.avatar_url && (
                <img 
                  src={msg.sender.avatar_url} 
                  alt="avatar" 
                  style={{ width: '28px', height: '28px', borderRadius: '50%', marginRight: '0.5rem', alignSelf: 'flex-end', objectFit: 'cover', cursor: 'pointer', marginBottom: '0.25rem' }} 
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewUserProfileId(msg.sender_id);
                  }}
                />
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
                maxWidth: '70%', 
                display: 'flex',
                flexDirection: 'column',
                alignItems: isMine ? 'flex-end' : 'flex-start'
              }}>
                <div style={{ 
                  padding: msg.media_url ? '0.35rem' : '0.75rem 1rem', 
                  borderRadius: 'var(--radius-lg)', 
                  backgroundColor: isDeleted ? 'transparent' : (isMine ? 'var(--accent-primary)' : 'var(--bg-tertiary)'),
                  color: isDeleted ? 'var(--text-secondary)' : (isMine ? 'white' : 'var(--text-primary)'),
                  border: isDeleted ? '1px solid var(--border-color)' : 'none',
                  borderBottomRightRadius: isMine ? '0' : 'var(--radius-lg)',
                  borderBottomLeftRadius: !isMine ? '0' : 'var(--radius-lg)',
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
                          ) : (
                            <a href={msg.media_url} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>View Attachment</a>
                          )}
                        </div>
                      )}
                      {msg.content && <div style={{ padding: msg.media_url ? '0 0.5rem 0.25rem 0.5rem' : '0' }}>{msg.content}</div>}
                      {!isMine && chat.is_group && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', marginBottom: '0.25rem', fontWeight: 600, padding: msg.media_url ? '0 0.5rem' : '0' }}>
                          {getDisplayName(msg.sender_id, msg.sender?.username)}
                        </div>
                      )}
                    </>
                  )}

                  {isMine && !isDeleted && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                      <Check size={12} color="rgba(255,255,255,0.7)" />
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
          );
        })}
        {typingUsers.length > 0 && (
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            {typingUsers.join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} typing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ backgroundColor: 'var(--bg-secondary)' }}>
        {/* Reply Indicator Bar */}
        {replyTo && (
          <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-tertiary)' }}>
            <div style={{ fontSize: '0.875rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>Replying to {replyTo.sender?.username || 'user'}</span>
              <div style={{ color: 'var(--text-secondary)' }} className="truncate">{replyTo.content || 'Media'}</div>
            </div>
            <button className="btn" onClick={() => setReplyTo(null)} style={{ padding: '0.25rem' }}>
              <X size={16} />
            </button>
          </div>
        )}
        
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button type="button" className="btn" style={{ padding: '0.5rem' }} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Paperclip size={18} />
            </button>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
            
            <input 
              type="text" 
              className="input" 
              placeholder={uploading ? 'Uploading...' : 'Type a message...'} 
              value={input}
              onChange={handleInputChange}
              style={{ flex: 1 }}
              disabled={uploading}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0 1.5rem' }} disabled={uploading}>
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
      
      {lightboxImage && (
        <Lightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />
      )}
    </div>
  );
}
