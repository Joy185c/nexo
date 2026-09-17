import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = () => {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        height: '100dvh', 
        alignItems: 'center', 
        justifyContent: 'center', 
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)' 
      }}>
        <div style={{
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <img src="/favicon.svg" alt="Nexo Logo" style={{ width: '80px', height: '80px' }} />
          <h1 style={{ 
            fontSize: '2rem', 
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.05em'
          }}>
            Nexo
          </h1>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
