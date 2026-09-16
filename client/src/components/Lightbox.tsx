import { X, Download } from 'lucide-react';

export default function Lightbox({ src, onClose }: { src: string, onClose: () => void }) {
  const handleDownload = async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      // Extract filename from URL or use a default
      const filename = src.split('/').pop()?.split('?')[0] || 'downloaded_image.jpg';
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to download image', err);
      // Fallback for CORS restricted images: just open in new tab
      window.open(src, '_blank');
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.9)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(5px)'
      }}
      onClick={onClose}
    >
      <div 
        style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '1rem', zIndex: 10000 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={handleDownload}
          className="btn" 
          style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', padding: '0.5rem', borderRadius: '50%' }}
          title="Download"
        >
          <Download size={24} />
        </button>
        <button 
          onClick={onClose}
          className="btn" 
          style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', padding: '0.5rem', borderRadius: '50%' }}
          title="Close"
        >
          <X size={24} />
        </button>
      </div>
      
      <img 
        src={src} 
        alt="Fullscreen Media" 
        style={{ 
          maxWidth: '90vw', 
          maxHeight: '90vh', 
          objectFit: 'contain',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }} 
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
