import { useState, useEffect } from 'react';
import { getChats, searchUsers, searchMessages, createChat, createGroup, deleteConversation } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Search, User, Circle, MessageSquare, Settings, Trash2, Users, LogOut } from 'lucide-react';
import SettingsModal from './SettingsModal';
import ProfileModal from './ProfileModal';
import { supabase } from '../lib/supabase';
import { useNotifications } from '../hooks/useNotifications';

export default function Sidebar({ onSelectChat, activeChatId }: { onSelectChat: (chat: any) => void, activeChatId: string | null }) {
  const [chats, setChats] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'users' | 'messages'>('users');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const { logout, onlineUsers, user, profile, contacts } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChatId, user]);

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

  const handleStartChat = async (userId: string) => {
    try {
      const res = await createChat(userId);
      await loadChats();
      setSearchQuery('');
      const newChat = chats.find(c => c.id === res.id) || { id: res.id, name: 'New Chat' };
      onSelectChat(newChat);
    } catch (e) { console.error(e); }
  };

  const handleCreateGroup = async () => {
    const name = prompt('Enter group name:');
    if (!name?.trim()) return;
    try {
      const res = await createGroup(name);
      await loadChats();
      onSelectChat({ id: res.id, name });
    } catch (e) { console.error(e); }
  };

  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this conversation? This will hide it from your list.')) {
      try {
        await deleteConversation(chatId);
        if (activeChatId === chatId) onSelectChat(null);
        await loadChats();
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div 
              onClick={() => setShowProfile(true)}
              style={{ width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', backgroundColor: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, overflow: 'hidden', border: '2px solid var(--bg-primary)' }}
              title="My Profile"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="me" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span>{profile?.username?.charAt(0).toUpperCase() || 'U'}</span>
              )}
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Chats</h2>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <button onClick={handleCreateGroup} className="btn" style={{ padding: '0.4rem', color: 'var(--text-primary)', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)' }} title="New Group">
              <Users size={16} />
            </button>
            <button onClick={() => setShowSettings(true)} className="btn" style={{ padding: '0.4rem', color: 'var(--text-secondary)' }} title="Settings">
              <Settings size={18} />
            </button>
            <button onClick={logout} className="btn" style={{ padding: '0.4rem', color: 'var(--danger)' }} title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
          <input 
            className="input" 
            style={{ paddingLeft: '2.5rem' }} 
            placeholder={`Search ${searchMode}...`} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div style={{ display: 'flex', marginTop: '0.5rem', gap: '0.5rem' }}>
            <button 
              style={{ flex: 1, padding: '0.25rem', fontSize: '0.75rem', backgroundColor: searchMode === 'users' ? 'var(--accent-primary)' : 'transparent', color: searchMode === 'users' ? 'white' : 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
              onClick={() => setSearchMode('users')}
            >Users</button>
            <button 
              style={{ flex: 1, padding: '0.25rem', fontSize: '0.75rem', backgroundColor: searchMode === 'messages' ? 'var(--accent-primary)' : 'transparent', color: searchMode === 'messages' ? 'white' : 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
              onClick={() => setSearchMode('messages')}
            >Messages</button>
          </div>
        </div>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
        {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
        {searchQuery ? (
          <div>
            <div style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Search Results</div>
            {searchMode === 'users' ? searchResults.map(user => {
              const isOnline = onlineUsers.includes(user.id);
              return (
                <div 
                  key={user.id} 
                  onClick={() => handleStartChat(user.id)}
                  style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}
                >
                  <div style={{ position: 'relative', width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={20} color="white" />
                    {isOnline && <Circle size={12} fill="var(--success)" color="var(--success)" style={{ position: 'absolute', bottom: 0, right: 0, border: '2px solid var(--bg-secondary)', borderRadius: '50%' }} />}
                  </div>
                  <div>{user.username}</div>
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
                  style={{ padding: '1rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                    <MessageSquare size={12} /> {msg.chats?.name || 'Chat'}
                  </div>
                  <div style={{ fontSize: '0.875rem' }}>{msg.content}</div>
                </div>
            ))}
          </div>
        ) : (
          <div>
            {chats.map(chat => {
              let isOnline = false;
              if (!chat.is_group && chat.members) {
                const otherMember = chat.members.find((m: any) => m.user_id !== user?.id);
                if (otherMember) {
                  isOnline = onlineUsers.includes(otherMember.user_id);
                }
              }

              return (
                <div 
                  key={chat.id} 
                  onClick={() => onSelectChat(chat)}
                  style={{ 
                    padding: '1rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '1rem', 
                    cursor: 'pointer',
                    backgroundColor: activeChatId === chat.id ? 'var(--bg-tertiary)' : 'transparent',
                    borderBottom: '1px solid var(--border-color)'
                  }}
                >
                  <div style={{ position: 'relative', width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={20} color="white" />
                    {isOnline && <Circle size={12} fill="var(--success)" color="var(--success)" style={{ position: 'absolute', bottom: 0, right: 0, border: '2px solid var(--bg-secondary)', borderRadius: '50%' }} />}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 500 }}>{getChatName(chat)}</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {chat.last_message ? chat.last_message.content || 'Sent media' : 'No messages yet'}
                    </div>
                  </div>
                  {chat.unread_count > 0 && (
                    <div style={{ backgroundColor: 'var(--accent-primary)', color: 'white', borderRadius: '1rem', padding: '0.1rem 0.5rem', fontSize: '0.75rem', fontWeight: 600 }}>
                      {chat.unread_count}
                    </div>
                  )}
                  <button 
                    className="btn" 
                    style={{ padding: '0.25rem', color: 'var(--danger)', opacity: 0.5 }}
                    onClick={(e) => handleDeleteChat(e, chat.id)}
                    title="Delete Conversation"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
