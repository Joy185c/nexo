import { useState, useEffect } from 'react';
import { getChats, searchUsers, searchMessages, createChat, createGroup, getCallHistory, getMoods, deleteConversation, toggleArchiveChat } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Search, User, Circle, MessageSquare, Settings, Users, LogOut, Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Plus, MessageCircle, MoreVertical, Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import SettingsModal from './SettingsModal';
import ProfileModal from './ProfileModal';
import MoodCreator from './MoodCreator';
import MoodViewer from './MoodViewer';
import FriendsModal from './FriendsModal';
import CreateGroupModal from './CreateGroupModal';
import ConfirmModal from './ConfirmModal';
import { supabase } from '../lib/supabase';
import { useNotifications } from '../hooks/useNotifications';

export default function Sidebar({ onSelectChat, activeChatId, activeTab, setActiveTab }: any) {
  const [chats, setChats] = useState<any[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.chat-menu-container')) {
        setMenuOpenId(null);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'users' | 'messages'>('users');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  const [callHistory, setCallHistory] = useState<any[]>([]);
  const { logout, onlineUsers, user, profile, contacts } = useAuth();
  
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  
  const [moods, setMoods] = useState<any[]>([]);
  const [showMoodCreator, setShowMoodCreator] = useState(false);
  const [moodViewerData, setMoodViewerData] = useState<{ grouped: any[][], index: number } | null>(null);

  const notifications = useNotifications();

  const getChatName = (chat: any) => {
    if (chat.is_group) return chat.name;
    const otherMember = chat.members?.find((m: any) => m.user_id !== user?.id);
    if (otherMember) {
      const contact = contacts.find(c => c.contact_id === otherMember.user_id);
      if (contact?.custom_nickname) return contact.custom_nickname;
    }
    return chat.name;
  };

  useEffect(() => {
    loadChats();
    loadMoods();
    notifications.requestPermission();

    const channel = supabase.channel('global_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.new.sender_id !== user?.id) {
          if (payload.new.chat_id !== activeChatId || document.visibilityState === 'hidden') {
            notifications.notify('New Message', { body: payload.new.content || 'Sent an attachment' });
            loadChats();
          }
        }
      })
      .subscribe();

    const handleChatUpdate = () => {
      loadChats();
    };
    window.addEventListener('chat_updated', handleChatUpdate);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('chat_updated', handleChatUpdate);
    };
  }, [activeChatId, user]);

  const loadMoods = async () => {
    try {
      const res = await getMoods();
      setMoods(res);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (searchQuery.trim().length > 2) {
      const delayFn = setTimeout(async () => {
        try {
          if (searchMode === 'users') {
            const res = await searchUsers(searchQuery);
            setSearchResults(res);
          } else {
            const res = await searchMessages(searchQuery);
            setSearchResults(res);
          }
        } catch (e) { console.error(e); }
      }, 500);
      return () => clearTimeout(delayFn);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, searchMode]);

  const loadChats = async () => {
    try {
      const res = await getChats();
      setChats(res);
    } catch (e) { console.error(e); }
  };

  const loadCalls = async () => {
    try {
      const res = await getCallHistory();
      setCallHistory(res);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (activeTab === 'calls') {
      loadCalls();
    }
  }, [activeTab]);

  const handleStartChat = async (userId: string) => {
    try {
      const res = await createChat(userId);
      await loadChats();
      setSearchQuery('');
      const newChat = chats.find(c => c.id === res.id) || { id: res.id, name: 'New Chat' };
      onSelectChat(newChat);
    } catch (e) { console.error(e); }
  };

  const handleCreateGroup = async (name: string) => {
    try {
      const res = await createGroup(name);
      await loadChats();
      onSelectChat({ id: res.id, name });
      setShowGroupModal(false);
    } catch (e) { console.error(e); }
  };

  const handleArchiveChat = async (chatId: string, isArchived: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleArchiveChat(chatId, isArchived);
      await loadChats();
      if (activeChatId === chatId && isArchived) {
        onSelectChat(null); // Deselect if archiving
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpenId(null);
    setChatToDelete(chatId);
  };

  const confirmDeleteChat = async () => {
    if (!chatToDelete) return;
    try {
      await deleteConversation(chatToDelete);
      await loadChats();
      if (activeChatId === chatToDelete) {
        onSelectChat(null); // Deselect if deleting
      }
      setChatToDelete(null);
    } catch (err: any) { 
      console.error(err);
      alert('Error deleting chat: ' + err.message);
      setChatToDelete(null);
    }
  };

  // Nav Item Component for Left Rail / Bottom Nav
  const NavItem = ({ id, icon: Icon, label }: any) => (
    <div 
      onClick={() => {
        if (id === 'settings') setShowSettings(true);
        else if (id === 'friends') setShowFriends(true);
        else setActiveTab(id);
      }}
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        gap: '0.25rem',
        cursor: 'pointer',
        padding: '0.5rem',
        color: activeTab === id ? 'var(--accent-primary)' : 'var(--text-secondary)',
        flex: 1,
        transition: 'all 0.2s'
      }}
    >
      <div style={{
        padding: '0.5rem',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: activeTab === id ? 'var(--accent-muted)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <Icon size={24} strokeWidth={activeTab === id ? 2.5 : 2} />
      </div>
      <span className="desktop-only" style={{ fontSize: '0.65rem', fontWeight: activeTab === id ? 600 : 500 }}>{label}</span>
    </div>
  );

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'row' }}>
      
      {/* Desktop Left Rail Navigation */}
      <div className="desktop-only" style={{ width: 'clamp(64px, 6vw, 80px)', flexShrink: 0, height: '100%', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem 0' }}>
        <div style={{ marginBottom: '2rem', color: 'var(--accent-primary)', fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-1px' }}>N</div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, width: '100%' }}>
          <NavItem id="chats" icon={MessageCircle} label="Chats" />
          <NavItem id="calls" icon={Phone} label="Calls" />
          <NavItem id="friends" icon={Users} label="Friends" />
          <NavItem id="settings" icon={Settings} label="Settings" />
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
          <div 
            onClick={() => setShowProfile(true)}
            style={{ width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', border: '2px solid transparent', transition: 'border 0.2s' }}
            title="My Profile"
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="me" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span>{profile?.username?.charAt(0).toUpperCase() || 'U'}</span>
            )}
          </div>
          <button onClick={logout} className="btn-icon" style={{ color: 'var(--text-secondary)' }} title="Logout">
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Main List Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-secondary)', overflow: 'hidden' }}>
        
        {/* Header & Search */}
        <div style={{ padding: '1.5rem 1rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {activeTab === 'chats' ? 'Chats' : activeTab === 'calls' ? 'Calls' : 'Nexo'}
            </h2>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {activeTab === 'chats' && (
                <button onClick={() => setShowGroupModal(true)} className="btn btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', gap: '0.25rem' }}>
                  <Plus size={16} /> <span className="mobile-hidden">New Group</span>
                </button>
              )}
              <div className="mobile-only" style={{ display: 'flex', gap: '0.5rem' }}>
                <div 
                  onClick={() => setShowProfile(true)}
                  style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {profile?.avatar_url ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={16} />}
                </div>
              </div>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              className="input" 
              style={{ paddingLeft: '2.5rem', backgroundColor: 'var(--bg-primary)' }} 
              placeholder={`Search ${searchMode}...`} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {searchQuery && (
            <div style={{ display: 'flex', marginTop: '0.75rem', gap: '0.5rem' }}>
              <button 
                style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem', fontWeight: 600, backgroundColor: searchMode === 'users' ? 'var(--bg-primary)' : 'transparent', color: searchMode === 'users' ? 'var(--accent-primary)' : 'var(--text-secondary)', border: 'none', borderRadius: 'var(--radius-full)' }}
                onClick={() => setSearchMode('users')}
              >Users</button>
              <button 
                style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem', fontWeight: 600, backgroundColor: searchMode === 'messages' ? 'var(--bg-primary)' : 'transparent', color: searchMode === 'messages' ? 'var(--accent-primary)' : 'var(--text-secondary)', border: 'none', borderRadius: 'var(--radius-full)' }}
                onClick={() => setSearchMode('messages')}
              >Messages</button>
            </div>
          )}
        </div>
        
        {/* Lists */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
          {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
          {showFriends && <FriendsModal onClose={() => setShowFriends(false)} onStartChat={onSelectChat} />}
          {showGroupModal && <CreateGroupModal onClose={() => setShowGroupModal(false)} onSubmit={handleCreateGroup} />}
          
          {searchQuery ? (
            <div>
              <div style={{ padding: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Search Results</div>
              {searchMode === 'users' ? searchResults.map(user => {
                const isOnline = onlineUsers.includes(user.id);
                return (
                  <div 
                    key={user.id} 
                    onClick={() => handleStartChat(user.id)}
                    style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{ position: 'relative', width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {user.avatar_url ? <img src={user.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={24} color="var(--text-secondary)" />}
                      {isOnline && <Circle size={14} fill="var(--success)" color="var(--bg-secondary)" strokeWidth={2} style={{ position: 'absolute', bottom: 0, right: 0 }} />}
                    </div>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{user.username}</div>
                  </div>
                );
              }) : searchResults.map(msg => (
                  <div 
                    key={msg.id} 
                    onClick={() => {
                      const existingChat = chats.find(c => c.id === msg.chat_id);
                      if (existingChat) onSelectChat(existingChat);
                      setSearchQuery('');
                    }}
                    style={{ padding: '1rem', cursor: 'pointer', borderBottom: '1px solid var(--border-light)', transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                      <MessageSquare size={12} /> {msg.chats?.name || 'Chat'}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{msg.content}</div>
                  </div>
              ))}
            </div>
          ) : activeTab === 'calls' ? (
            <div>
              {callHistory.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No call history</div>}
              {callHistory.map(call => {
                const isOutgoing = call.caller_id === user?.id;
                const otherUser = isOutgoing ? call.receiver : call.caller;
                const isMissed = call.status === 'missed' || call.status === 'declined';
                
                let Icon = isOutgoing ? PhoneOutgoing : PhoneIncoming;
                if (isMissed) Icon = PhoneMissed;

                return (
                  <div 
                    key={call.id} 
                    style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'background 0.2s', borderBottom: '1px solid var(--border-light)' }}
                  >
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {otherUser?.avatar_url ? <img src={otherUser.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={24} color="var(--text-secondary)" />}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, color: isMissed ? 'var(--danger)' : 'var(--text-primary)', fontSize: '0.95rem' }}>{otherUser?.full_name || otherUser?.username || 'Unknown'}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.2rem' }}>
                        <Icon size={12} color={isMissed ? 'var(--danger)' : isOutgoing ? 'var(--text-secondary)' : 'var(--success)'} />
                        {new Date(call.created_at).toLocaleString()} • {call.call_type === 'video' ? 'Video' : 'Audio'}
                      </div>
                    </div>
                    <button className="btn-icon" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--accent-primary)' }} onClick={() => {
                      const existingChat = chats.find(c => !c.is_group && c.members?.some((m:any) => m.user_id === otherUser?.id));
                      if (existingChat) {
                        onSelectChat(existingChat);
                        setActiveTab('chats');
                      } else {
                        handleStartChat(otherUser?.id);
                      }
                    }}>
                      <Phone size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              {/* Moods Section */}
              <div style={{ padding: '1rem 0 1rem 1rem', display: 'flex', gap: '1rem', overflowX: 'auto', borderBottom: '1px solid var(--border-light)', scrollbarWidth: 'none' }}>
                <div 
                  onClick={() => setShowMoodCreator(true)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', minWidth: '64px' }}
                >
                  <div style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '50%', border: '2px solid var(--border-color)', padding: '2px' }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {profile?.avatar_url ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={24} color="var(--text-secondary)" />}
                    </div>
                    <div style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: 'var(--accent-primary)', color: 'white', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg-secondary)' }}>
                      <Plus size={14} />
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Story</div>
                </div>

                {Array.from(new Set(moods.map(m => m.user_id))).map((uId, idx) => {
                  const userMoods = moods.filter(m => m.user_id === uId);
                  const userObj = userMoods[0]?.user;
                  if (!userObj) return null;
                  const allGrouped = Array.from(new Set(moods.map(m => m.user_id))).map(id => moods.filter(m => m.user_id === id));
                  
                  return (
                    <div 
                      key={uId}
                      onClick={() => setMoodViewerData({ grouped: allGrouped, index: idx })}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', minWidth: '64px' }}
                    >
                      <div style={{ width: '60px', height: '60px', borderRadius: '50%', border: '2px solid var(--accent-primary)', padding: '2px' }}>
                        <div style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {userObj.avatar_url ? <img src={userObj.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={24} color="var(--text-secondary)" />}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '64px' }}>
                        {uId === profile?.id ? 'You' : userObj.username}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Chat List */}
              <div style={{ paddingTop: '0.5rem' }}>
                
                {/* Archived Toggle Button */}
                {chats.some(c => c.is_archived) && !showArchived && (
                  <div 
                    onClick={() => setShowArchived(true)}
                    style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}
                  >
                    <Archive size={20} />
                    <span style={{ fontWeight: 600 }}>Archived</span>
                  </div>
                )}
                
                {showArchived && (
                  <div 
                    onClick={() => setShowArchived(false)}
                    style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-primary)' }}
                  >
                    <ArchiveRestore size={20} />
                    <span style={{ fontWeight: 600 }}>Back to Chats</span>
                  </div>
                )}

                {chats.filter(c => showArchived ? c.is_archived : !c.is_archived).map(chat => {
                  let isOnline = false;
                  if (!chat.is_group && chat.members) {
                    const otherMember = chat.members.find((m: any) => m.user_id !== user?.id);
                    if (otherMember) isOnline = onlineUsers.includes(otherMember.user_id);
                  }

                  const isActive = activeChatId === chat.id;

                  return (
                    <div 
                      key={chat.id} 
                      onClick={() => onSelectChat(chat)}
                      style={{ 
                        padding: '0.75rem 1rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '1rem', 
                        cursor: 'pointer',
                        backgroundColor: isActive ? 'var(--accent-muted)' : 'transparent',
                        position: 'relative',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => !isActive && (e.currentTarget.style.backgroundColor = 'var(--bg-primary)')}
                      onMouseLeave={e => !isActive && (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Active Indicator Line */}
                      {isActive && <div style={{ position: 'absolute', left: 0, top: '10%', bottom: '10%', width: '4px', backgroundColor: 'var(--accent-primary)', borderRadius: '0 4px 4px 0' }} />}
                      
                      <div style={{ position: 'relative', width: '52px', height: '52px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {chat.avatar_url ? (
                          <img src={chat.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <User size={24} color="var(--text-secondary)" />
                        )}
                        {isOnline && <Circle size={14} fill="var(--success)" color="var(--bg-secondary)" strokeWidth={2} style={{ position: 'absolute', bottom: 0, right: 0 }} />}
                      </div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.2rem' }}>
                          <span style={{ fontWeight: chat.unread_count > 0 ? 700 : 600, fontSize: '0.95rem', color: 'var(--text-primary)' }} className="truncate">{getChatName(chat)}</span>
                          <span style={{ fontSize: '0.7rem', color: chat.unread_count > 0 ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: chat.unread_count > 0 ? 600 : 400 }}>
                            {chat.updated_at ? new Date(chat.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', color: chat.unread_count > 0 ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: chat.unread_count > 0 ? 500 : 400 }} className="truncate">
                            {chat.last_message ? (chat.last_message.content?.startsWith('E2EE:') ? '🔒 Encrypted Message' : (chat.last_message.content || 'Sent media')) : 'No messages yet'}
                          </span>
                          {chat.unread_count > 0 && (
                            <div style={{ backgroundColor: 'var(--accent-primary)', color: 'white', borderRadius: '1rem', minWidth: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, padding: '0 6px' }}>
                              {chat.unread_count}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* 3-dot Menu */}
                      <div style={{ position: 'relative' }} className="chat-menu-container">
                        <button 
                          className="btn-icon" 
                          style={{ color: 'var(--text-secondary)', padding: '0.25rem' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === chat.id ? null : chat.id);
                          }}
                        >
                          <MoreVertical size={18} />
                        </button>
                        
                        {menuOpenId === chat.id && (
                          <div 
                            style={{ 
                              position: 'absolute', right: 0, top: '100%', zIndex: 100,
                              backgroundColor: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
                              boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-color)',
                              padding: '0.25rem', minWidth: '120px', display: 'flex', flexDirection: 'column'
                            }}
                          >
                            <button 
                              className="btn" 
                              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', justifyContent: 'flex-start', color: 'var(--text-primary)' }}
                              onClick={(e) => handleArchiveChat(chat.id, !chat.is_archived, e)}
                            >
                              {chat.is_archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                              {chat.is_archived ? 'Unarchive' : 'Archive'}
                            </button>
                            <button 
                              className="btn" 
                              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', justifyContent: 'flex-start', color: 'var(--danger)' }}
                              onClick={(e) => handleDeleteChat(chat.id, e)}
                            >
                              <Trash2 size={16} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Mobile Bottom Navigation */}
      <div className="bottom-nav">
        <NavItem id="chats" icon={MessageCircle} label="Chats" />
        <NavItem id="calls" icon={Phone} label="Calls" />
        <NavItem id="friends" icon={Users} label="Friends" />
        <NavItem id="settings" icon={Settings} label="Settings" />
      </div>

      {showMoodCreator && <MoodCreator onClose={() => setShowMoodCreator(false)} onCreated={() => { setShowMoodCreator(false); loadMoods(); }} />}
      {moodViewerData && <MoodViewer groupedMoods={moodViewerData.grouped} initialUserIndex={moodViewerData.index} onClose={() => setMoodViewerData(null)} />}
    </div>
  );
}
