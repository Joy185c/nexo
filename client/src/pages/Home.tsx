import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';

export default function Home() {
  const [activeChat, setActiveChat] = useState<any>(null);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: 'var(--bg-primary)' }}>
      <div className={`sidebar-container ${activeChat ? 'mobile-hidden' : ''}`} style={{ width: '300px', height: '100%', borderRight: '1px solid var(--border-color)' }}>
        <Sidebar onSelectChat={setActiveChat} activeChatId={activeChat?.id || null} />
      </div>
      <div className={!activeChat ? 'mobile-hidden' : ''} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ChatWindow chat={activeChat} onBack={() => setActiveChat(null)} />
      </div>
    </div>
  );
}
