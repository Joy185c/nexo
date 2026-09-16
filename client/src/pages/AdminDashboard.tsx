import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { verifyAdminSecret, getAdminDashboard, getAdminUsers, setAdminUserAction, resetUserPassword } from '../services/api';
import { Shield, Users, Activity, MessageSquare, Ban, Pause, Play, KeyRound, AlertTriangle, LogOut, Loader2, ArrowLeft } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AdminDashboard() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [secretCode, setSecretCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'users'>('overview');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);

  useEffect(() => {
    // Initial check (maybe they already have admin role)
    if (session) {
      verifyAdminSecret('').then(res => {
        if (res.is_admin) {
          setIsAuthenticated(true);
          loadDashboardData();
        }
      }).catch(() => {}).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [session]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
    }
    // AuthContext will handle the session update, which triggers the useEffect above
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await verifyAdminSecret(secretCode);
      if (res.is_admin) {
        setIsAuthenticated(true);
        loadDashboardData();
      } else {
        setError('Invalid secret code or unauthorized account.');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async () => {
    try {
      const data = await getAdminDashboard();
      setDashboardData(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadUsersData = async () => {
    try {
      const data = await getAdminUsers();
      setUsersList(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'overview') loadDashboardData();
      if (activeTab === 'users') loadUsersData();
    }
  }, [isAuthenticated, activeTab]);

  const handleUserAction = async (userId: string, action: string) => {
    if (!confirm(`Are you sure you want to change user status to ${action}?`)) return;
    try {
      await setAdminUserAction(userId, action);
      loadUsersData(); // refresh list
    } catch (err: any) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const handleResetPassword = async (userId: string) => {
    const newPass = prompt("Enter new password for this user (min 6 chars):");
    if (!newPass) return;
    try {
      await resetUserPassword(userId, newPass);
      alert('Password reset successfully.');
    } catch (err: any) {
      alert('Failed to reset password: ' + err.message);
    }
  };

  if (loading && !isAuthenticated && session) {
    return <div style={{ height: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}><Loader2 className="spin" size={32} /></div>;
  }

  if (!session) {
    return (
      <div style={{ height: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '3rem', borderRadius: 'var(--radius-lg)', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', backgroundColor: 'rgba(56, 189, 248, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
            <Shield size={32} color="#38bdf8" />
          </div>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '1.5rem' }}>Admin Gateway</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>Please authenticate your identity to proceed.</p>
          
          <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
            <div>
              <input type="email" className="input" placeholder="Admin Email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <input type="password" className="input" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            {error && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center' }}>{error}</div>}
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
              {loading ? <Loader2 className="spin" size={20} /> : 'Authenticate'}
            </button>
          </form>
          <button onClick={() => navigate('/')} style={{ marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', gap: '0.5rem' }}>
            <ArrowLeft size={16} /> Return to App
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ height: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '3rem', borderRadius: 'var(--radius-lg)', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', backgroundColor: 'rgba(56, 189, 248, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
            <Shield size={32} color="#38bdf8" />
          </div>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '1.5rem' }}>Admin Access Restricted</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>Please enter the secret code to access the control panel.</p>
          
          <form onSubmit={handleVerify}>
            <input 
              type="password" 
              className="input" 
              placeholder="Secret Code" 
              value={secretCode}
              onChange={e => setSecretCode(e.target.value)}
              style={{ width: '100%', marginBottom: '1rem', textAlign: 'center', letterSpacing: '0.2rem', fontSize: '1.2rem' }}
              autoFocus
            />
            {error && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</div>}
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? <Loader2 className="spin" size={20} /> : 'Verify & Enter'}
            </button>
          </form>
          <button onClick={() => navigate('/')} style={{ marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', gap: '0.5rem' }}>
            <ArrowLeft size={16} /> Return to App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Admin Sidebar */}
      <div style={{ width: '250px', backgroundColor: '#1e293b', padding: '1.5rem', display: 'flex', flexDirection: 'column', color: '#fff', borderRight: '1px solid #334155' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '3rem' }}>
          <Shield size={28} color="#38bdf8" />
          <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '0.5px' }}>NEXO ADMIN</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <button 
            onClick={() => setActiveTab('overview')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: 'none', background: activeTab === 'overview' ? 'rgba(56, 189, 248, 0.15)' : 'transparent', color: activeTab === 'overview' ? '#38bdf8' : '#cbd5e1', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', fontWeight: activeTab === 'overview' ? 600 : 400 }}
          >
            <Activity size={18} /> Overview
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: 'none', background: activeTab === 'users' ? 'rgba(56, 189, 248, 0.15)' : 'transparent', color: activeTab === 'users' ? '#38bdf8' : '#cbd5e1', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', fontWeight: activeTab === 'users' ? 600 : 400 }}
          >
            <Users size={18} /> Manage Users
          </button>
        </div>

        <button onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: 'none', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', cursor: 'pointer' }}>
          <LogOut size={18} /> Exit Panel
        </button>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 3rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '2rem' }}>
          {activeTab === 'overview' ? 'Dashboard Overview' : 'User Management'}
        </h1>

        {activeTab === 'overview' && dashboardData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
              {[
                { label: 'Total Users', value: dashboardData.totalUsers, icon: Users, color: '#3b82f6' },
                { label: 'Active Today', value: dashboardData.activeToday, icon: Activity, color: '#10b981' },
                { label: 'Total Groups', value: dashboardData.totalGroups, icon: Shield, color: '#f59e0b' },
                { label: 'Total Messages', value: dashboardData.totalMessages, icon: MessageSquare, color: '#8b5cf6' },
              ].map((stat, i) => (
                <div key={i} style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1.25rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: `${stat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <stat.icon size={24} color={stat.color} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '0.25rem' }}>{stat.label}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stat.value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Chart Area */}
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-color)', height: '400px' }}>
              <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: 600 }}>App Engagement Trend (Messages Sent)</h3>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboardData.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMsgs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                  <YAxis stroke="var(--text-secondary)" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                  />
                  <Area type="monotone" dataKey="messages" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorMsgs)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '1rem', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>USER</th>
                  <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>ROLE</th>
                  <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>STATUS</th>
                  <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>TIME SPENT (MIN)</th>
                  <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                        {u.avatar_url ? <img src={u.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Users size={16} style={{ margin: '10px' }}/>}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500 }}>{u.username}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{u.email}</div>
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ padding: '0.25rem 0.5rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600, backgroundColor: u.system_role === 'admin' ? 'rgba(56, 189, 248, 0.1)' : 'var(--bg-tertiary)', color: u.system_role === 'admin' ? '#38bdf8' : 'var(--text-secondary)' }}>
                        {u.system_role.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ padding: '0.25rem 0.5rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600, 
                        backgroundColor: u.account_status === 'active' ? 'rgba(16, 185, 129, 0.1)' : 
                                         u.account_status === 'suspended' ? 'rgba(245, 158, 11, 0.1)' :
                                         u.account_status === 'paused' ? 'rgba(100, 116, 139, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: u.account_status === 'active' ? '#10b981' : 
                               u.account_status === 'suspended' ? '#f59e0b' : 
                               u.account_status === 'paused' ? '#64748b' : '#ef4444' }}>
                        {u.account_status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      {u.total_time_spent}m
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        {u.account_status !== 'active' && (
                          <button onClick={() => handleUserAction(u.id, 'active')} title="Activate" className="btn-icon" style={{ color: '#10b981' }}><Play size={16} /></button>
                        )}
                        {u.account_status !== 'paused' && (
                          <button onClick={() => handleUserAction(u.id, 'paused')} title="Pause" className="btn-icon" style={{ color: '#64748b' }}><Pause size={16} /></button>
                        )}
                        {u.account_status !== 'suspended' && (
                          <button onClick={() => handleUserAction(u.id, 'suspended')} title="Suspend" className="btn-icon" style={{ color: '#f59e0b' }}><AlertTriangle size={16} /></button>
                        )}
                        {u.account_status !== 'banned' && (
                          <button onClick={() => handleUserAction(u.id, 'banned')} title="Ban" className="btn-icon" style={{ color: '#ef4444' }}><Ban size={16} /></button>
                        )}
                        <button onClick={() => handleResetPassword(u.id)} title="Reset Password" className="btn-icon" style={{ color: '#3b82f6', marginLeft: '0.5rem' }}><KeyRound size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
