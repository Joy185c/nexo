import { supabase } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL;

const getAuthToken = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
};

const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  
  let data;
  try {
    data = await res.json();
  } catch (err) {
    if (!res.ok) throw new Error(`Server Error: ${res.status} ${res.statusText}`);
    throw new Error('Invalid response from server');
  }
  
  if (!res.ok || !data.success) {
    throw new Error(data.error?.message || 'API Error');
  }
  return data.data;
};

export const searchUsers = (query: string) => apiFetch(`/users?q=${encodeURIComponent(query)}`);
export const getChats = () => apiFetch(`/chats`);
export const createChat = (userId: string) => apiFetch(`/chats`, { method: 'POST', body: JSON.stringify({ user_id: userId }) });
export const getMessages = (chatId: string, page = 1) => apiFetch(`/messages/${chatId}?page=${page}`);
export const sendMessage = (chatId: string, content: string, media_url?: string, media_type?: string, reply_to_id?: string) => 
  apiFetch(`/messages`, { method: 'POST', body: JSON.stringify({ chat_id: chatId, content, media_url, media_type, reply_to_id }) });

export const createGroup = (name: string, members: string[] = []) => apiFetch(`/chats/group`, { method: 'POST', body: JSON.stringify({ name, members }) });
export const updateGroup = (chatId: string, data: { name?: string, avatar_url?: string }) => apiFetch(`/chats/${chatId}`, { method: 'PATCH', body: JSON.stringify(data) });
export const addMember = (chatId: string, userId: string) => apiFetch(`/chats/${chatId}/members`, { method: 'POST', body: JSON.stringify({ user_id: userId }) });
export const removeMember = (chatId: string, userId: string) => apiFetch(`/chats/${chatId}/members/${userId}`, { method: 'DELETE' });
export const updateRole = (chatId: string, userId: string, role: string) => apiFetch(`/chats/${chatId}/members/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
export const markAsRead = (chatId: string) => apiFetch(`/messages/${chatId}/read`, { method: 'POST' });
export const searchMessages = (query: string) => apiFetch(`/messages/search?q=${encodeURIComponent(query)}`);

// Phase 12 Additions
export const reactToMessage = (chatId: string, messageId: string, emoji: string) => apiFetch(`/messages/${chatId}/messages/${messageId}/reaction`, { method: 'PUT', body: JSON.stringify({ emoji }) });
export const pinMessage = (chatId: string, messageId: string) => apiFetch(`/messages/${chatId}/messages/${messageId}/pin`, { method: 'PUT' });
export const unsendMessage = (chatId: string, messageId: string) => apiFetch(`/messages/${chatId}/messages/${messageId}`, { method: 'DELETE' });
export const deleteForMe = (chatId: string, messageId: string) => apiFetch(`/messages/${chatId}/messages/${messageId}/delete-for-me`, { method: 'PUT' });
export const deleteConversation = (chatId: string) => apiFetch(`/chats/${chatId}`, { method: 'DELETE' });
export const toggleArchiveChat = (chatId: string, isArchived: boolean) => apiFetch(`/chats/${chatId}/archive`, { method: 'PATCH', body: JSON.stringify({ is_archived }) });

// Phase 14 Additions
export const getUserProfile = (userId: string) => apiFetch(`/users/${userId}`);
export const updateProfile = (data: { full_name?: string, nickname?: string, bio?: string, avatar_url?: string, username?: string, mobile_number?: string, is_private?: boolean }) => apiFetch(`/users/me`, { method: 'PUT', body: JSON.stringify(data) });

// Phase 15 Additions
export const getUserPreferences = () => apiFetch(`/users/me/preferences`);
export const blockUser = (userId: string) => apiFetch(`/users/${userId}/block`, { method: 'POST' });
export const unblockUser = (userId: string) => apiFetch(`/users/${userId}/block`, { method: 'DELETE' });
export const setCustomNickname = (userId: string, nickname: string) => apiFetch(`/users/contacts/${userId}`, { method: 'PUT', body: JSON.stringify({ custom_nickname: nickname }) });
export const getSharedMedia = (userId: string) => apiFetch(`/users/${userId}/media`);

// Calls
export const getCallHistory = () => apiFetch('/calls');
export const logCall = (data: { receiver_id: string, chat_id?: string, call_type: string, status: string, duration: number }) => apiFetch('/calls', { method: 'POST', body: JSON.stringify(data) });

// Phase 18: Friends & Moods
export const getFriends = () => apiFetch('/friends');
export const sendFriendRequest = (userId: string) => apiFetch(`/friends/request/${userId}`, { method: 'POST' });
export const acceptFriendRequest = (userId: string) => apiFetch(`/friends/accept/${userId}`, { method: 'PUT' });
export const removeFriend = (userId: string) => apiFetch(`/friends/remove/${userId}`, { method: 'DELETE' });

export const getMoods = () => apiFetch('/moods');
export const createMood = (content_type: 'text' | 'image', content_url: string) => apiFetch('/moods', { method: 'POST', body: JSON.stringify({ content_type, content_url }) });
export const deleteMood = (id: string) => apiFetch(`/moods/${id}`, { method: 'DELETE' });

// Phase 20 & 21
export const registerDevice = async (device_id: string) => apiFetch('/users/device/register', { method: 'POST', body: JSON.stringify({ device_id }) });
export const sendHeartbeat = async () => apiFetch('/users/heartbeat', { method: 'POST' });

// --- Admin Endpoints ---
export const verifyAdminSecret = async (code: string) => apiFetch('/admin/verify-secret', { method: 'POST', body: JSON.stringify({ code }) });
export const getAdminDashboard = async () => apiFetch('/admin/dashboard');
export const getAdminUsers = async () => apiFetch('/admin/users');
export const setAdminUserAction = async (userId: string, action: string) => apiFetch(`/admin/users/${userId}/action`, { method: 'POST', body: JSON.stringify({ action }) });
export const resetUserPassword = async (userId: string, newPassword: string) => apiFetch(`/admin/users/${userId}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) });

// WebRTC
export const getTurnServers = async () => apiFetch('/webrtc/turn');
