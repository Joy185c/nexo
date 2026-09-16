import { useState, useEffect } from 'react';
import { getUserProfile, blockUser, unblockUser, setCustomNickname, getSharedMedia, sendFriendRequest, acceptFriendRequest, removeFriend } from '../services/api';
import { X, User, Edit3, ShieldAlert, ShieldCheck, Image as ImageIcon, UserPlus, UserCheck, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Lightbox from './Lightbox';
import { supabase } from '../lib/supabase';

export default function UserProfile({ userId, chatId, onClose }: { userId: string, chatId?: string, onClose: () => void }) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { blockedUsers, fetchPreferences, contacts, user, friends, fetchFriends } = useAuth();
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  
  const [sharedMedia, setSharedMedia] = useState<any[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  
  const isBlocked = blockedUsers.includes(userId);
  const isSelf = user?.id === userId;
  
  const customContact = contacts.find(c => c.contact_id === userId);
  const friendship = friends.find(f => f.user1?.id === userId || f.user2?.id === userId);

  // Chat-specific wallpaper
  const [wallpaperImage, setWallpaperImage] = useState(chatId ? localStorage.getItem(`nexo_wallpaper_image_${chatId}`) || '' : '');
  const [wallpaperOpacity, setWallpaperOpacity] = useState(parseInt(chatId ? localStorage.getItem(`nexo_wallpaper_opacity_${chatId}`) || '100' : '100', 10));
  const [uploadingWallpaper, setUploadingWallpaper] = useState(false);

  const updateChatWallpaper = (image: string, opacity: number) => {
    setWallpaperImage(image);
    setWallpaperOpacity(opacity);
    if (chatId) {
      if (image) localStorage.setItem(`nexo_wallpaper_image_${chatId}`, image);
      else localStorage.removeItem(`nexo_wallpaper_image_${chatId}`);
      
      localStorage.setItem(`nexo_wallpaper_opacity_${chatId}`, opacity.toString());
      window.dispatchEvent(new Event('wallpaper_changed'));
    }
  };

  const handleWallpaperUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatId) return;

    try {
      setUploadingWallpaper(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `wallpaper_${chatId}_${Date.now()}.${fileExt}`;

      const { error } = await supabase.storage.from('avatars').upload(fileName, file);
      if (error) throw error;

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      updateChatWallpaper(data.publicUrl, wallpaperOpacity);
    } catch (err: any) {
      console.error(err);
      alert('Failed to upload wallpaper: ' + err.message);
    } finally {
      setUploadingWallpaper(false);
    }
  };

  useEffect(() => {
    loadProfile();
    loadSharedMedia();
  }, [userId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await getUserProfile(userId);
      setProfile(res);
      setNicknameInput(customContact?.custom_nickname || '');
    } catch (err) {
      console.error(err);
      alert('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const loadSharedMedia = async () => {
    try {
      setLoadingMedia(true);
      const res = await getSharedMedia(userId);
      // Filter out only image media types for the grid
      const imageMedia = res.filter((m: any) => m.media_type?.startsWith('image/'));
      setSharedMedia(imageMedia);
    } catch (err) {
      console.error('Failed to load shared media', err);
    } finally {
      setLoadingMedia(false);
    }
  };

  const handleToggleBlock = async () => {
    try {
      if (isBlocked) {
        await unblockUser(userId);
      } else {
        if (!confirm('Are you sure you want to block this user? They will not be able to message you.')) return;
        await blockUser(userId);
      }
      await fetchPreferences();
    } catch (err) {
      console.error(err);
      alert('Failed to update block status');
    }
  };

  const handleSaveNickname = async () => {
    try {
      await setCustomNickname(userId, nicknameInput);
      await fetchPreferences();
      setIsEditingNickname(false);
    } catch (err) {
      console.error(err);
      alert('Failed to save nickname');
    }
  };

  const handleFriendAction = async (action: 'add' | 'accept' | 'remove') => {
    try {
      if (action === 'add') await sendFriendRequest(userId);
      if (action === 'accept') await acceptFriendRequest(userId);
      if (action === 'remove') await removeFriend(userId);
      await fetchFriends();
    } catch (err) {
      console.error(err);
      alert('Failed to perform friend action');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: 'clamp(1.25rem, 5vw, 2rem)', width: '100%', maxWidth: '400px', border: '1px solid var(--border-color)', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', color: 'var(--text-secondary)' }}>
          <X size={20} />
        </button>
        
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem 0' }}>Loading profile...</div>
        ) : profile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingTop: '1rem' }}>
            
            {/* Header Section: Avatar & Info */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '96px', height: '96px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid var(--bg-secondary)', boxShadow: '0 0 0 2px var(--accent-primary)' }}>
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User size={40} color="var(--text-secondary)" />
                )}
              </div>
              
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  {customContact?.custom_nickname || profile.full_name || profile.username}
                  {!isSelf && (
                    <button onClick={() => setIsEditingNickname(!isEditingNickname)} style={{ color: 'var(--text-secondary)', padding: '0.2rem' }}>
                      <Edit3 size={16} />
                    </button>
                  )}
                </h2>
                
                {isEditingNickname && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'center' }}>
                    <input className="input" style={{ padding: '0.4rem 0.75rem', fontSize: '0.875rem', width: '200px' }} placeholder="Set custom name..." value={nicknameInput} onChange={e => setNicknameInput(e.target.value)} />
                    <button className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.875rem' }} onClick={handleSaveNickname}>Save</button>
                  </div>
                )}
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
                  <span style={{ color: 'var(--accent-primary)', fontSize: '0.95rem', fontWeight: 500 }}>@{profile.username}</span>
                  {profile.nickname && <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>aka "{profile.nickname}"</span>}
                </div>
              </div>
            </div>

            {/* Action Buttons Row */}
            {!isSelf && (
              <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                {/* Friend Action */}
                {!friendship ? (
                  <button onClick={() => handleFriendAction('add')} className="btn btn-primary" style={{ flex: 1, padding: '0.6rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <UserPlus size={16} /> Add Friend
                  </button>
                ) : friendship.status === 'accepted' ? (
                  <button onClick={() => { if(confirm('Remove this friend?')) handleFriendAction('remove') }} className="btn" style={{ flex: 1, padding: '0.6rem', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <UserCheck size={16} color="var(--success)" /> Friends
                  </button>
                ) : friendship.action_user_id === user?.id ? (
                  <button onClick={() => handleFriendAction('remove')} className="btn" style={{ flex: 1, padding: '0.6rem', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <Clock size={16} /> Requested
                  </button>
                ) : (
                  <>
                    <button onClick={() => handleFriendAction('accept')} className="btn btn-primary" style={{ flex: 1, padding: '0.6rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <UserCheck size={16} /> Accept
                    </button>
                    <button onClick={() => handleFriendAction('remove')} className="btn" style={{ padding: '0.6rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', display: 'flex', justifyContent: 'center' }}>
                      <X size={16} />
                    </button>
                  </>
                )}

                {/* Block Action */}
                <button 
                  onClick={handleToggleBlock}
                  className="btn" 
                  style={{ 
                    padding: '0.6rem 1rem', 
                    backgroundColor: isBlocked ? 'var(--bg-tertiary)' : 'rgba(239, 68, 68, 0.1)', 
                    color: isBlocked ? 'var(--text-primary)' : 'var(--danger)', 
                    display: 'flex', gap: '0.5rem', justifyContent: 'center',
                    flex: isBlocked ? 1 : 'none'
                  }}
                  title={isBlocked ? 'Unblock User' : 'Block User'}
                >
                  {isBlocked ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
                  {isBlocked && <span>Unblock</span>}
                </button>
              </div>
            )}

            {/* Bio Card */}
            <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1.25rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem', fontWeight: 600 }}>About</div>
              <div style={{ fontSize: '0.95rem', lineHeight: '1.5', whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
                {profile.bio || <span style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>No bio available.</span>}
              </div>
              <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Joined NEXO on {new Date(profile.last_seen || profile.created_at || Date.now()).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>

            <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-color)', margin: '1rem 0' }} />

            {/* Custom Chat Wallpaper */}
            {chatId && (
              <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <ImageIcon size={18} color="var(--accent-primary)" /> Chat Wallpaper
                </div>
                
                {wallpaperImage && (
                  <div style={{ position: 'relative', width: '100%', height: '120px', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
                    <img src={wallpaperImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button 
                      onClick={() => updateChatWallpaper('', 100)}
                      className="btn-icon"
                      style={{ position: 'absolute', top: '5px', right: '5px', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--accent-primary)', fontWeight: 500, fontSize: '0.85rem' }}>
                  <ImageIcon size={18} style={{ marginRight: '0.5rem' }} />
                  {uploadingWallpaper ? 'Uploading...' : 'Set Custom Wallpaper'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploadingWallpaper} onChange={handleWallpaperUpload} />
                </label>

                {wallpaperImage && (
                  <div style={{ marginTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <span>Transparency</span>
                      <span>{wallpaperOpacity}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={wallpaperOpacity}
                      onChange={(e) => updateChatWallpaper(wallpaperImage, parseInt(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                    />
                  </div>
                )}
              </div>
            )}

            <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-color)', margin: '1rem 0' }} />

            <div style={{ width: '100%' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <ImageIcon size={18} color="var(--accent-primary)" /> Shared Media
              </div>
              
              {loadingMedia ? (
                <div style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Loading media...</div>
              ) : sharedMedia.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                  {sharedMedia.map(media => (
                    <div 
                      key={media.id} 
                      onClick={() => setLightboxImage(media.media_url)}
                      style={{ 
                        aspectRatio: '1', 
                        cursor: 'pointer',
                        overflow: 'hidden',
                        borderRadius: '4px'
                      }}
                    >
                      <img 
                        src={media.media_url} 
                        alt="shared" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.2s' }} 
                        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)', padding: '1rem 0' }}>
                  No shared photos found
                </div>
              )}
            </div>

          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--danger)' }}>Profile not found</div>
        )}
      </div>

      {lightboxImage && (
        <Lightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />
      )}
    </div>
  );
}
