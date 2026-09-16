import { useState, useEffect, useRef } from 'react';
import { X, Camera, Edit2, Shield, UserMinus, UserPlus, LogOut, Check, Image as ImageIcon } from 'lucide-react';
import { updateGroup, addMember, removeMember, updateRole, getFriends } from '../services/api';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function GroupProfileModal({ chat, onClose, onUpdate }: any) {
  const { user } = useAuth();
  const [name, setName] = useState(chat.name || '');
  const [avatarUrl, setAvatarUrl] = useState(chat.avatar_url || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [friends, setFriends] = useState<any[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const myMembership = chat.members?.find((m: any) => m.user_id === user?.id);
  const isAdmin = myMembership?.role === 'admin';

  // Chat-specific wallpaper
  const [wallpaperImage, setWallpaperImage] = useState(chat.id ? localStorage.getItem(`nexo_wallpaper_image_${chat.id}`) || '' : '');
  const [wallpaperOpacity, setWallpaperOpacity] = useState(parseInt(chat.id ? localStorage.getItem(`nexo_wallpaper_opacity_${chat.id}`) || '100' : '100', 10));
  const [uploadingWallpaper, setUploadingWallpaper] = useState(false);

  const updateChatWallpaper = (image: string, opacity: number) => {
    setWallpaperImage(image);
    setWallpaperOpacity(opacity);
    if (chat.id) {
      if (image) localStorage.setItem(`nexo_wallpaper_image_${chat.id}`, image);
      else localStorage.removeItem(`nexo_wallpaper_image_${chat.id}`);
      
      localStorage.setItem(`nexo_wallpaper_opacity_${chat.id}`, opacity.toString());
      window.dispatchEvent(new Event('wallpaper_changed'));
    }
  };

  const handleWallpaperUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chat.id) return;

    try {
      setUploadingWallpaper(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `wallpaper_${chat.id}_${Date.now()}.${fileExt}`;

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
    if (isAdmin && showAddMember) {
      getFriends().then(setFriends).catch(console.error);
    }
  }, [isAdmin, showAddMember]);

  const handleNameSave = async () => {
    if (!name.trim() || name === chat.name) {
      setIsEditingName(false);
      return;
    }
    try {
      await updateGroup(chat.id, { name: name.trim() });
      onUpdate({ name: name.trim() });
      setIsEditingName(false);
    } catch (e) {
      console.error(e);
      alert('Failed to update group name');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${user!.id}_group_${chat.id}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      
      await updateGroup(chat.id, { avatar_url: data.publicUrl });
      setAvatarUrl(data.publicUrl);
      onUpdate({ avatar_url: data.publicUrl });
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      alert(`Error: ${error.message || error.toString()}`);
    } finally {
      setUploading(false);
    }
  };

  const handleAddMember = async (friend: any) => {
    try {
      await addMember(chat.id, friend.id);
      
      // Update local state instantly so the UI reflects the added member
      if (!chat.members) chat.members = [];
      chat.members.push({ chat_id: chat.id, user_id: friend.id, role: 'member', user: friend });
      
      onUpdate({ members: chat.members });
      setShowAddMember(false);
    } catch (e: any) {
      alert(e.message || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Remove this member?')) return;
    try {
      await removeMember(chat.id, userId);
      
      // Update local state instantly
      chat.members = chat.members?.filter((m: any) => m.user_id !== userId) || [];
      onUpdate({ members: chat.members });
    } catch (e: any) {
      alert(e.message || 'Failed to remove member');
    }
  };

  const handleMakeAdmin = async (userId: string) => {
    if (!confirm('Make this member an admin?')) return;
    try {
      await updateRole(chat.id, userId, 'admin');
      
      // Update local state instantly
      const member = chat.members?.find((m: any) => m.user_id === userId);
      if (member) member.role = 'admin';
      onUpdate({ members: chat.members });
    } catch (e: any) {
      alert(e.message || 'Failed to update role');
    }
  };

  const handleLeaveGroup = async () => {
    if (!confirm('Are you sure you want to leave this group?')) return;
    try {
      await removeMember(chat.id, user!.id);
      onUpdate(); // this should close the chat window in parent
      onClose();
    } catch (e: any) {
      alert(e.message || 'Failed to leave group');
    }
  };

  // Filter out friends who are already members
  const acceptedFriends = friends.filter(f => f.status === 'accepted');
  const availableFriends = acceptedFriends.map(f => {
    const isUser1 = f.user1?.id === user?.id;
    const friend = isUser1 ? f.user2 : f.user1;
    return { ...f, friend };
  }).filter(f => f.friend && !chat.members?.some((m: any) => m.user_id === f.friend.id));

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div 
        style={{ 
          backgroundColor: 'var(--bg-primary)', 
          width: '100%', 
          maxWidth: '500px', 
          maxHeight: '90vh',
          borderRadius: 'var(--radius-lg)', 
          display: 'flex', 
          flexDirection: 'column', 
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden'
        }}
      >
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 700 }}>Group Info</h2>
          <button onClick={onClose} className="btn-icon"><X size={20} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          
          {/* Avatar Section */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: '120px', height: '120px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', overflow: 'hidden', border: '3px solid var(--border-light)' }}>
                {avatarUrl ? (
                  <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', color: 'var(--text-secondary)' }}>
                    {chat.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {isAdmin && (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="btn-icon" 
                  style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: 'var(--accent-primary)', color: 'white', border: '2px solid var(--bg-primary)', padding: '8px', boxShadow: 'var(--shadow-md)' }}
                  title="Change Picture"
                >
                  <Camera size={16} />
                </button>
              )}
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleAvatarUpload} style={{ display: 'none' }} />
            </div>

            {/* Name Section */}
            <div style={{ marginTop: '1rem', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {isEditingName ? (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input 
                    autoFocus
                    className="input" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    style={{ textAlign: 'center', fontSize: '1.25rem', fontWeight: 600, padding: '0.25rem 0.5rem' }} 
                  />
                  <button onClick={handleNameSave} className="btn-icon" style={{ color: 'var(--success)' }}><Check size={20} /></button>
                  <button onClick={() => { setIsEditingName(false); setName(chat.name); }} className="btn-icon"><X size={20} /></button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)', fontWeight: 700 }}>{chat.name}</h3>
                  {isAdmin && (
                    <button onClick={() => setIsEditingName(true)} className="btn-icon" style={{ color: 'var(--text-secondary)' }}><Edit2 size={16} /></button>
                  )}
                </div>
              )}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              Group • {chat.members?.length || 0} members
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '1.5rem 0' }} />

          {/* Members List */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Members</h4>
              {isAdmin && (
                <button 
                  onClick={() => setShowAddMember(!showAddMember)} 
                  className="btn" 
                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem', backgroundColor: showAddMember ? 'var(--bg-tertiary)' : 'var(--accent-muted)', color: showAddMember ? 'var(--text-secondary)' : 'var(--accent-primary)' }}
                >
                  <UserPlus size={16} style={{ marginRight: '0.4rem' }} /> Add
                </button>
              )}
            </div>

            {showAddMember && isAdmin && (
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-lg)', marginBottom: '1.5rem', border: '1px solid var(--border-light)' }}>
                <h5 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem' }}>Add Friends</h5>
                {availableFriends.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No more friends to add.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {availableFriends.map(f => (
                      <div key={f.friend.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                            {f.friend.avatar_url && <img src={f.friend.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                          </div>
                          <span style={{ fontWeight: 500 }}>{f.friend.username}</span>
                        </div>
                        <button onClick={() => handleAddMember(f.friend)} className="btn btn-primary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>Add</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {chat.members?.map((member: any) => (
                <div key={member.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                      {member.user?.avatar_url && <img src={member.user.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {member.user?.username} {member.user_id === user?.id && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>(You)</span>}
                        {member.role === 'admin' && <Shield size={12} color="var(--accent-primary)" />}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: member.role === 'admin' ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                        {member.role === 'admin' ? 'Group Admin' : 'Member'}
                      </div>
                    </div>
                  </div>
                  
                  {isAdmin && member.user_id !== user?.id && (
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      {member.role !== 'admin' && (
                        <button onClick={() => handleMakeAdmin(member.user_id)} className="btn-icon" title="Make Admin" style={{ color: 'var(--accent-primary)' }}><Shield size={16} /></button>
                      )}
                      <button onClick={() => handleRemoveMember(member.user_id)} className="btn-icon" title="Remove Member" style={{ color: 'var(--danger)' }}><UserMinus size={16} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '1.5rem 0' }} />

          {/* Custom Chat Wallpaper */}
          <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
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

          <button 
            onClick={handleLeaveGroup} 
            className="btn" 
            style={{ width: '100%', padding: '0.75rem', color: 'var(--danger)', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', justifyContent: 'center', gap: '0.5rem', fontWeight: 600 }}
          >
            <LogOut size={18} /> Leave Group
          </button>

        </div>
      </div>
    </div>
  );
}
