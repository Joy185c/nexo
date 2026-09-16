import { useState } from 'react';
import { X, User, UserMinus, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { acceptFriendRequest, removeFriend, createChat } from '../services/api';

export default function FriendsModal({ onClose, onStartChat }: { onClose: () => void, onStartChat: (chat: any) => void }) {
  const { friends, user, fetchFriends } = useAuth();
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');

  const acceptedFriends = friends.filter(f => f.status === 'accepted');
  
  // Requests received by me (I am user2, or action_user is not me)
  const pendingRequests = friends.filter(f => f.status === 'pending' && f.action_user_id !== user?.id);
  
  // Requests sent by me
  const sentRequests = friends.filter(f => f.status === 'pending' && f.action_user_id === user?.id);

  const handleAction = async (action: 'accept' | 'remove', targetId: string) => {
    try {
      if (action === 'accept') await acceptFriendRequest(targetId);
      if (action === 'remove') await removeFriend(targetId);
      await fetchFriends();
    } catch (err) {
      console.error(err);
      alert('Failed to update friend status');
    }
  };

  const handleMessage = async (targetId: string) => {
    try {
      const chat = await createChat(targetId);
      onStartChat(chat);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to start chat');
    }
  };

  const renderUser = (friendship: any, type: 'friend' | 'received' | 'sent') => {
    const isUser1 = friendship.user1?.id === user?.id;
    const otherUser = isUser1 ? friendship.user2 : friendship.user1;
    if (!otherUser) return null;

    return (
      <div key={friendship.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {otherUser.avatar_url ? <img src={otherUser.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={20} color="var(--text-secondary)" />}
          </div>
          <div>
            <div style={{ fontWeight: 500 }}>{otherUser.full_name || otherUser.username}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>@{otherUser.username}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {type === 'friend' && (
            <>
              <button onClick={() => handleMessage(otherUser.id)} className="btn" style={{ padding: '0.4rem', color: 'var(--accent-primary)', backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: '50%' }} title="Message">
                <MessageSquare size={16} />
              </button>
              <button onClick={() => { if(confirm('Remove friend?')) handleAction('remove', otherUser.id) }} className="btn" style={{ padding: '0.4rem', color: 'var(--danger)' }} title="Remove Friend">
                <UserMinus size={16} />
              </button>
            </>
          )}
          {type === 'received' && (
            <>
              <button onClick={() => handleAction('accept', otherUser.id)} className="btn btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem' }}>Accept</button>
              <button onClick={() => handleAction('remove', otherUser.id)} className="btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>Reject</button>
            </>
          )}
          {type === 'sent' && (
            <button onClick={() => handleAction('remove', otherUser.id)} className="btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem', backgroundColor: 'var(--bg-tertiary)' }}>Cancel Request</button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Friends</h2>
          <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}>
            <X size={20} />
          </button>
        </div>
        
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
          <button 
            onClick={() => setActiveTab('friends')}
            style={{ flex: 1, padding: '1rem', textAlign: 'center', borderBottom: activeTab === 'friends' ? '2px solid var(--accent-primary)' : 'none', color: activeTab === 'friends' ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'friends' ? 600 : 400 }}
          >
            My Friends ({acceptedFriends.length})
          </button>
          <button 
            onClick={() => setActiveTab('requests')}
            style={{ flex: 1, padding: '1rem', textAlign: 'center', borderBottom: activeTab === 'requests' ? '2px solid var(--accent-primary)' : 'none', color: activeTab === 'requests' ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'requests' ? 600 : 400, position: 'relative' }}
          >
            Requests
            {pendingRequests.length > 0 && (
              <span style={{ position: 'absolute', top: '10px', right: '20px', backgroundColor: 'var(--danger)', color: 'white', fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '10px' }}>{pendingRequests.length}</span>
            )}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {activeTab === 'friends' ? (
            <div>
              {acceptedFriends.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No friends yet. Search for users to add them!</div>
              ) : (
                acceptedFriends.map(f => renderUser(f, 'friend'))
              )}
            </div>
          ) : (
            <div>
              {pendingRequests.length > 0 && (
                <div style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', backgroundColor: 'var(--bg-tertiary)' }}>Received Requests</div>
              )}
              {pendingRequests.map(f => renderUser(f, 'received'))}
              
              {sentRequests.length > 0 && (
                <div style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', backgroundColor: 'var(--bg-tertiary)' }}>Sent Requests</div>
              )}
              {sentRequests.map(f => renderUser(f, 'sent'))}

              {pendingRequests.length === 0 && sentRequests.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No pending requests.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
