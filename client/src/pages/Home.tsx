import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';

export default function Home() {
  const [activeChat, setActiveChat] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'chats' | 'contacts' | 'groups' | 'settings'>('chats');
  
  const [wallpaperColor, setWallpaperColor] = useState(localStorage.getItem('nexo_wallpaper_color') || 'default');
  const [doodlesEnabled, setDoodlesEnabled] = useState(localStorage.getItem('nexo_wallpaper_doodles') !== 'false');
  const [wallpaperImage, setWallpaperImage] = useState(localStorage.getItem('nexo_wallpaper_image') || '');
  const [wallpaperOpacity, setWallpaperOpacity] = useState(parseInt(localStorage.getItem('nexo_wallpaper_opacity') || '100', 10));
  const [wallpaperTick, setWallpaperTick] = useState(0); // Used to force re-render for chat-specific settings

  useEffect(() => {
    const handleWallpaperChange = () => {
      setWallpaperColor(localStorage.getItem('nexo_wallpaper_color') || 'default');
      setDoodlesEnabled(localStorage.getItem('nexo_wallpaper_doodles') !== 'false');
      setWallpaperImage(localStorage.getItem('nexo_wallpaper_image') || '');
      setWallpaperOpacity(parseInt(localStorage.getItem('nexo_wallpaper_opacity') || '100', 10));
      setWallpaperTick(prev => prev + 1);
    };
    window.addEventListener('wallpaper_changed', handleWallpaperChange);
    return () => window.removeEventListener('wallpaper_changed', handleWallpaperChange);
  }, []);

  const chatSpecificImage = activeChat ? localStorage.getItem(`nexo_wallpaper_image_${activeChat.id}`) : null;
  const chatSpecificOpacity = activeChat ? localStorage.getItem(`nexo_wallpaper_opacity_${activeChat.id}`) : null;
  const displayImage = chatSpecificImage || wallpaperImage;
  const displayOpacity = chatSpecificOpacity ? parseInt(chatSpecificOpacity, 10) : wallpaperOpacity;

  return (
    <div className="app-container">
      {/* Sidebar Area (Desktop/Tablet: Fluid Width, Mobile: 100% when no chat active) */}
      <div 
        className={`sidebar-container ${activeChat ? 'mobile-hidden' : ''}`} 
        style={{ 
          width: 'clamp(280px, 30vw, 380px)', 
          flexShrink: 0,
          height: '100%', 
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-secondary)',
          zIndex: 10
        }}
      >
        <Sidebar 
          onSelectChat={setActiveChat} 
          activeChatId={activeChat?.id || null} 
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      </div>
      
      {/* Main Chat Area (Desktop: flex-1, Mobile: 100% when chat active) */}
      <div 
        className={!activeChat ? 'mobile-hidden' : ''} 
        style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          overflow: 'hidden',
          backgroundColor: (wallpaperColor && wallpaperColor !== 'default') ? wallpaperColor : 'var(--bg-primary)',
          position: 'relative'
        }}
      >
        {/* Custom Background Image layer */}
        {displayImage && (
          <div 
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${displayImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: displayOpacity / 100,
              zIndex: 0,
              pointerEvents: 'none'
            }}
          />
        )}
        
        {/* Subtle Background Pattern / Doodles */}
        {doodlesEnabled && <div className="chat-bg-pattern" style={{ zIndex: 0 }}></div>}
        
        {activeChat ? (
          <ChatWindow chat={activeChat} onBack={() => setActiveChat(null)} />
        ) : (
          <div className="desktop-only" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '1rem', letterSpacing: '-1px' }}>
                NEXO
              </div>
              <h2 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.5rem' }}>Your conversations start here.</h2>
              <p>Select a conversation to start chatting securely.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
