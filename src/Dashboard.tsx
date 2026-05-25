import React, { useState, useEffect, useRef } from 'react';
import api from './api';

interface Chat {
    ID: number;
    name: string;
    is_group: boolean;
    users?: UserProfile[];
    messages?: Message[];
}

interface Message {
    ID: number;
    content: string;
    user_id: number;
    chat_id: number;
    CreatedAt: string;
}

interface UserProfile {
    ID: number;
    username: string;
    email: string;
}

interface DashboardProps {
    onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [chats, setChats] = useState<Chat[]>([]);
    const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newChatName, setNewChatName] = useState('');
    const [isGroup, setIsGroup] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
    const [editingText, setEditingText] = useState('');

    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [profileEmail, setProfileEmail] = useState('');
    const [profileStatus, setProfileStatus] = useState('');

    const [sidebarTab, setSidebarTab] = useState<'chats' | 'search' | 'users'>('chats');
    const [messageSearchQuery, setMessageSearchQuery] = useState('');
    const [messageSearchResults, setMessageSearchResults] = useState<Message[]>([]);

    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [usersList, setUsersList] = useState<UserProfile[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

    const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
    const readMessageCountsRef = useRef<Record<number, number>>({});

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchProfile();
        fetchUsersListOnly();
    }, []);

    useEffect(() => {
        fetchChats(searchQuery);

        const interval = setInterval(() => {
            fetchChats(searchQuery);
        }, 3000);

        return () => clearInterval(interval);
    }, [searchQuery]);

    useEffect(() => {
        if (chats.length === 0) return;

        const newUnread: Record<number, number> = {};
        const currentReadCounts = readMessageCountsRef.current;

        chats.forEach(chat => {
            const totalMsgs = chat.messages ? chat.messages.length : 0;

            if (selectedChat && chat.ID === selectedChat.ID) {
                currentReadCounts[chat.ID] = totalMsgs;
                newUnread[chat.ID] = 0;
            } else {
                if (currentReadCounts[chat.ID] === undefined) {
                    currentReadCounts[chat.ID] = totalMsgs;
                    newUnread[chat.ID] = 0;
                } else {
                    const unread = totalMsgs - currentReadCounts[chat.ID];
                    newUnread[chat.ID] = unread > 0 ? unread : 0;
                }
            }
        });

        readMessageCountsRef.current = currentReadCounts;
        setUnreadCounts(newUnread);
    }, [chats, selectedChat]);

    useEffect(() => {
        if (sidebarTab === 'search') {
            fetchMessageSearchResults(messageSearchQuery);
        } else if (sidebarTab === 'users') {
            fetchUsers(userSearchQuery);
        }
    }, [messageSearchQuery, userSearchQuery, sidebarTab]);

    useEffect(() => {
        if (!selectedChat) return;

        fetchMessages(selectedChat.ID);

        const interval = setInterval(() => {
            fetchMessages(selectedChat.ID);
        }, 3000);

        return () => clearInterval(interval);
    }, [selectedChat]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchProfile = async () => {
        try {
            const res = await api.get('/profile');
            setProfile(res.data);
            if (res.data) {
                setProfileEmail(res.data.email);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchChats = async (query: string = '') => {
        try {
            const endpoint = query ? `/search/chats?q=${encodeURIComponent(query)}` : '/chats';
            const res = await api.get(endpoint);
            setChats(res.data || []);

            if (selectedChat) {
                const updatedSelected = (res.data || []).find((c: Chat) => c.ID === selectedChat.ID);
                if (updatedSelected) {
                    setSelectedChat(updatedSelected);
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchMessageSearchResults = async (query: string) => {
        if (!query.trim()) {
            setMessageSearchResults([]);
            return;
        }
        try {
            const res = await api.get(`/search/messages?q=${encodeURIComponent(query)}`);
            setMessageSearchResults(res.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchUsers = async (query: string = '') => {
        try {
            const endpoint = query ? `/search/users?q=${encodeURIComponent(query)}` : '/users';
            const res = await api.get(endpoint);
            setUsersList(res.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchUsersListOnly = async () => {
        try {
            const res = await api.get('/users');
            setUsersList(res.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchMessages = async (chatId: number) => {
        try {
            const res = await api.get(`/messages/chat/${chatId}`);
            setMessages(res.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreateChat = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newChatName.trim()) return;

        try {
            await api.post('/chats', {
                name: newChatName,
                is_group: isGroup,
                user_ids: selectedUserIds,
            });
            setNewChatName('');
            setIsGroup(false);
            setSelectedUserIds([]);
            setSearchQuery('');
            fetchChats();
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreateDirectChat = async (targetUsername: string, targetId: number) => {
        const chatName = `Chat with ${targetUsername}`;
        try {
            const res = await api.post('/chats', {
                name: chatName,
                is_group: false,
                user_ids: [targetId]
            });
            const newChat = res.data;
            setSearchQuery('');
            await fetchChats();
            handleSelectChat(newChat);
            setSidebarTab('chats');
        } catch (err) {
            console.error(err);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedChat) return;

        try {
            await api.post('/messages', {
                content: newMessage,
                chat_id: selectedChat.ID,
            });
            setNewMessage('');
            fetchMessages(selectedChat.ID);
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteMessage = async (messageId: number) => {
        try {
            await api.delete(`/messages/${messageId}`);
            if (selectedChat) {
                fetchMessages(selectedChat.ID);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleUpdateMessage = async (e: React.FormEvent, messageId: number) => {
        e.preventDefault();
        if (!editingText.trim()) return;

        try {
            await api.put(`/messages/${messageId}`, { content: editingText });
            setEditingMessageId(null);
            setEditingText('');
            if (selectedChat) {
                fetchMessages(selectedChat.ID);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteChat = async (chatId: number) => {
        const confirmDelete = window.confirm("Are you sure you want to delete this conversation? All messages will be lost.");
        if (!confirmDelete) return;

        try {
            await api.delete(`/chats/${chatId}`);
            setSelectedChat(null);
            fetchChats();
        } catch (err) {
            console.error(err);
        }
    };

    const startEditing = (message: Message) => {
        setEditingMessageId(message.ID);
        setEditingText(message.content);
    };

    const cancelEditing = () => {
        setEditingMessageId(null);
        setEditingText('');
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile || !profileEmail.trim()) return;

        try {
            await api.put(`/users/${profile.ID}`, {
                ...profile,
                email: profileEmail
            });
            setProfileStatus('Profile updated successfully!');
            fetchProfile();
        } catch (err) {
            console.error(err);
            setProfileStatus('Failed to update profile.');
        }
    };

    const handleDeleteAccount = async () => {
        if (!profile) return;
        const confirmDelete = window.confirm("Are you sure you want to delete your account? This action cannot be undone.");
        if (!confirmDelete) return;

        try {
            await api.delete(`/users/${profile.ID}`);
            onLogout();
        } catch (err) {
            console.error(err);
        }
    };

    const openProfileModal = () => {
        if (profile) {
            setProfileEmail(profile.email);
        }
        setProfileStatus('');
        setIsProfileOpen(true);
    };

    const handleSelectChatByMessage = (chatId: number) => {
        const targetChat = chats.find(c => c.ID === chatId);
        if (targetChat) {
            handleSelectChat(targetChat);
            setSidebarTab('chats');
        }
    };

    const handleUserCheckboxChange = (userId: number) => {
        setSelectedUserIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const handleSelectChat = (chat: Chat) => {
        setSelectedChat(chat);
        setUnreadCounts(prev => ({
            ...prev,
            [chat.ID]: 0
        }));

        const totalMsgs = chat.messages ? chat.messages.length : 0;
        readMessageCountsRef.current[chat.ID] = totalMsgs;
    };

    const getChatDisplayName = (chat: Chat) => {
        if (chat.is_group || !chat.users || !profile) {
            return chat.name;
        }
        const otherUser = chat.users.find(u => u.username !== profile.username);
        return otherUser ? `Chat with ${otherUser.username}` : chat.name;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: '"Inter", sans-serif', backgroundColor: '#f8fafc' }}>

            <header style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 24px',
                background: '#0f172a',
                color: 'white',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, letterSpacing: '-0.5px' }}>Messenger</h2>
                </div>
                {profile && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div
                            onClick={openProfileModal}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                        >
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: '#6366f1',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 600,
                                fontSize: '14px'
                            }}>
                                {profile.username.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontSize: '15px', fontWeight: 500, color: '#f1f5f9' }}>{profile.username}</span>
                        </div>
                        <button
                            onClick={onLogout}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 14px',
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                cursor: 'pointer',
                                borderRadius: '8px',
                                fontWeight: 600,
                                fontSize: '14px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                            Logout
                        </button>
                    </div>
                )}
            </header>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                <aside style={{ width: '320px', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', background: '#ffffff' }}>

                    <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9' }}>
                        <h4 style={{ marginTop: 0, marginBottom: '14px', color: '#1e293b', fontSize: '15px', fontWeight: 700 }}>New Chat</h4>
                        <form onSubmit={handleCreateChat} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <input
                                type="text"
                                placeholder="Enter chat name..."
                                value={newChatName}
                                onChange={(e) => setNewChatName(e.target.value)}
                                required
                                style={{
                                    padding: '10px 12px',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '10px',
                                    fontSize: '14px',
                                    outline: 'none',
                                    background: '#f8fafc'
                                }}
                            />

                            <div style={{ maxHeight: '80px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '8px', background: '#f8fafc' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>Invite Users:</div>
                                {usersList.filter(u => profile && u.ID !== profile.ID).map(user => (
                                    <label key={user.ID} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#1e293b', marginBottom: '4px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedUserIds.includes(user.ID)}
                                            onChange={() => handleUserCheckboxChange(user.ID)}
                                        />
                                        {user.username}
                                    </label>
                                ))}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b', cursor: 'pointer', fontWeight: 500 }}>
                                    <input
                                        type="checkbox"
                                        checked={isGroup}
                                        onChange={(e) => setIsGroup(e.target.checked)}
                                        style={{ cursor: 'pointer' }}
                                    />
                                    Group Conversation
                                </label>
                                <button type="submit" style={{
                                    padding: '8px 16px',
                                    background: '#6366f1',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '13px'
                                }}>
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>

                    <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                        <button
                            onClick={() => setSidebarTab('chats')}
                            style={{
                                flex: 1,
                                padding: '12px',
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: sidebarTab === 'chats' ? '#6366f1' : '#64748b',
                                borderBottom: sidebarTab === 'chats' ? '2px solid #6366f1' : '2px solid transparent',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            Chats
                        </button>
                        <button
                            onClick={() => setSidebarTab('search')}
                            style={{
                                flex: 1,
                                padding: '12px',
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: sidebarTab === 'search' ? '#6366f1' : '#64748b',
                                borderBottom: sidebarTab === 'search' ? '2px solid #6366f1' : '2px solid transparent',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            Search
                        </button>
                        <button
                            onClick={() => setSidebarTab('users')}
                            style={{
                                flex: 1,
                                padding: '12px',
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: sidebarTab === 'users' ? '#6366f1' : '#64748b',
                                borderBottom: sidebarTab === 'users' ? '2px solid #6366f1' : '2px solid transparent',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            Users
                        </button>
                    </div>

                    {sidebarTab === 'chats' && (
                        <>
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" style={{ position: 'absolute', left: '12px' }}>
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                    </svg>
                                    <input
                                        type="text"
                                        placeholder="Search conversations..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px 10px 36px',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '10px',
                                            fontSize: '14px',
                                            outline: 'none',
                                            background: '#f8fafc',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                                <h4 style={{ marginTop: 0, marginBottom: '12px', color: '#1e293b', fontSize: '15px', fontWeight: 700 }}>Conversations</h4>
                                {chats.length === 0 ? (
                                    <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>
                                        {searchQuery ? 'No results found' : 'No conversations yet.'}
                                    </p>
                                ) : (
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {chats.map((chat) => (
                                            <li
                                                key={chat.ID}
                                                onClick={() => handleSelectChat(chat)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: '12px',
                                                    padding: '12px 16px',
                                                    background: selectedChat?.ID === chat.ID ? '#f1f5f9' : '#ffffff',
                                                    border: selectedChat?.ID === chat.ID ? '1px solid #e2e8f0' : '1px solid #f1f5f9',
                                                    borderRadius: '12px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden', flex: 1 }}>
                                                    <div style={{
                                                        width: '40px',
                                                        height: '40px',
                                                        borderRadius: '10px',
                                                        background: chat.is_group ? '#e0e7ff' : '#f1f5f9',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: chat.is_group ? '#6366f1' : '#475569',
                                                        flexShrink: 0
                                                    }}>
                                                        {chat.is_group ? (
                                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                                                <circle cx="9" cy="7" r="4"></circle>
                                                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                                            </svg>
                                                        ) : (
                                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                                                <circle cx="12" cy="7" r="4"></circle>
                                                            </svg>
                                                        )}
                                                    </div>
                                                    <div style={{ overflow: 'hidden', flex: 1 }}>
                                                        <div style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {getChatDisplayName(chat)}
                                                        </div>
                                                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                                            {chat.is_group ? 'Group chat' : 'Direct message'}
                                                        </div>
                                                    </div>
                                                </div>

                                                {unreadCounts[chat.ID] > 0 && (
                                                    <div style={{
                                                        background: '#6366f1',
                                                        color: 'white',
                                                        borderRadius: '50%',
                                                        width: '20px',
                                                        height: '20px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '11px',
                                                        fontWeight: 'bold',
                                                        flexShrink: 0
                                                    }}>
                                                        {unreadCounts[chat.ID]}
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </>
                    )}

                    {sidebarTab === 'search' && (
                        <>
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" style={{ position: 'absolute', left: '12px' }}>
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                    </svg>
                                    <input
                                        type="text"
                                        placeholder="Search all messages..."
                                        value={messageSearchQuery}
                                        onChange={(e) => setMessageSearchQuery(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px 10px 36px',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '10px',
                                            fontSize: '14px',
                                            outline: 'none',
                                            background: '#f8fafc',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                                <h4 style={{ marginTop: 0, marginBottom: '12px', color: '#1e293b', fontSize: '15px', fontWeight: 700 }}>Search Results</h4>
                                {messageSearchResults.length === 0 ? (
                                    <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>
                                        {messageSearchQuery ? 'No messages found' : 'Type a keyword to find messages.'}
                                    </p>
                                ) : (
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {messageSearchResults.map((msg) => (
                                            <li
                                                key={msg.ID}
                                                onClick={() => handleSelectChatByMessage(msg.chat_id)}
                                                style={{
                                                    padding: '12px 16px',
                                                    background: '#ffffff',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '12px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <div style={{ fontSize: '11px', color: '#6366f1', fontWeight: 600, marginBottom: '4px' }}>
                                                    From User ID: {msg.user_id}
                                                </div>
                                                <div style={{ fontWeight: 500, fontSize: '13px', color: '#1e293b', wordBreak: 'break-all' }}>
                                                    {msg.content}
                                                </div>
                                                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '6px', textAlign: 'right' }}>
                                                    {new Date(msg.CreatedAt).toLocaleDateString()} {new Date(msg.CreatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </>
                    )}

                    {sidebarTab === 'users' && (
                        <>
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" style={{ position: 'absolute', left: '12px' }}>
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                    </svg>
                                    <input
                                        type="text"
                                        placeholder="Search users..."
                                        value={userSearchQuery}
                                        onChange={(e) => setUserSearchQuery(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px 10px 36px',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '10px',
                                            fontSize: '14px',
                                            outline: 'none',
                                            background: '#f8fafc',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                                <h4 style={{ marginTop: 0, marginBottom: '12px', color: '#1e293b', fontSize: '15px', fontWeight: 700 }}>Global Users</h4>
                                {usersList.length === 0 ? (
                                    <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>No users found.</p>
                                ) : (
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {usersList.map((user) => {
                                            const isSelf = profile ? user.ID === profile.ID : false;
                                            return (
                                                <li
                                                    key={user.ID}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '12px 16px',
                                                        background: '#ffffff',
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: '12px'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                                                        <div style={{
                                                            width: '32px',
                                                            height: '32px',
                                                            borderRadius: '50%',
                                                            background: '#e2e8f0',
                                                            color: '#475569',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '12px',
                                                            fontWeight: 600,
                                                            flexShrink: 0
                                                        }}>
                                                            {user.username.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {user.username} {isSelf && '(You)'}
                            </span>
                                                    </div>
                                                    {!isSelf && (
                                                        <button
                                                            onClick={() => handleCreateDirectChat(user.username, user.ID)}
                                                            style={{
                                                                padding: '6px 12px',
                                                                background: '#6366f1',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '8px',
                                                                cursor: 'pointer',
                                                                fontSize: '12px',
                                                                fontWeight: 600,
                                                                flexShrink: 0
                                                            }}
                                                        >
                                                            Message
                                                        </button>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </>
                    )}
                </aside>

                <main style={{ width: '70%', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
                    {selectedChat ? (
                        <>
                            <div style={{
                                padding: '16px 24px',
                                borderBottom: '1px solid #e2e8f0',
                                background: '#ffffff',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '12px'
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '50%',
                                            background: '#22c55e',
                                            flexShrink: 0
                                        }} />
                                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {getChatDisplayName(selectedChat)}
                                        </h3>
                                    </div>
                                    {selectedChat.users && selectedChat.users.length > 0 && (
                                        <div style={{ fontSize: '12px', color: '#64748b', paddingLeft: '22px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            Members: {selectedChat.users.map(u => u.username).join(', ')}
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => handleDeleteChat(selectedChat.ID)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: '#ef4444',
                                        padding: '8px',
                                        borderRadius: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'background 0.2s'
                                    }}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                        <line x1="10" y1="11" x2="10" y2="17"></line>
                                        <line x1="14" y1="11" x2="14" y2="17"></line>
                                    </svg>
                                </button>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {messages.length === 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#94a3b8' }}>
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '12px' }}>
                                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                                        </svg>
                                        <p style={{ margin: 0, fontSize: '14px' }}>No messages in this chat yet.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {messages.map((msg) => {
                                            const isOwnMessage = profile ? msg.user_id === profile.ID : false;
                                            const isEditing = editingMessageId === msg.ID;

                                            return (
                                                <div
                                                    key={msg.ID}
                                                    style={{
                                                        alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
                                                        maxWidth: '55%',
                                                        padding: '12px 16px',
                                                        borderRadius: isOwnMessage ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                                        background: isOwnMessage ? '#6366f1' : '#ffffff',
                                                        color: isOwnMessage ? '#ffffff' : '#1e293b',
                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                                        border: isOwnMessage ? 'none' : '1px solid #e2e8f0'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '6px' }}>
                            <span style={{ fontSize: '11px', color: isOwnMessage ? '#c7d2fe' : '#64748b', fontWeight: 600 }}>
                              {isOwnMessage ? 'You' : `User ID: ${msg.user_id}`}
                            </span>
                                                        {isOwnMessage && !isEditing && (
                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                <button
                                                                    onClick={() => startEditing(msg)}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#c7d2fe' }}
                                                                >
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                        <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteMessage(msg.ID)}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#fca5a5' }}
                                                                >
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                        <polyline points="3 6 5 6 21 6"></polyline>
                                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {isEditing ? (
                                                        <form onSubmit={(e) => handleUpdateMessage(e, msg.ID)} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                                                            <input
                                                                type="text"
                                                                value={editingText}
                                                                onChange={(e) => setEditingText(e.target.value)}
                                                                required
                                                                style={{
                                                                    padding: '6px 10px',
                                                                    borderRadius: '8px',
                                                                    border: '1px solid #cbd5e1',
                                                                    outline: 'none',
                                                                    fontSize: '13px',
                                                                    color: '#1e293b',
                                                                    background: '#ffffff',
                                                                    width: '100%',
                                                                    boxSizing: 'border-box'
                                                                }}
                                                            />
                                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={cancelEditing}
                                                                    style={{
                                                                        padding: '4px 8px',
                                                                        background: '#e2e8f0',
                                                                        color: '#475569',
                                                                        border: 'none',
                                                                        borderRadius: '6px',
                                                                        fontSize: '11px',
                                                                        fontWeight: 600,
                                                                        cursor: 'pointer'
                                                                    }}
                                                                >
                                                                    Cancel
                                                                </button>
                                                                <button
                                                                    type="submit"
                                                                    style={{
                                                                        padding: '4px 8px',
                                                                        background: '#4f46e5',
                                                                        color: 'white',
                                                                        border: 'none',
                                                                        borderRadius: '6px',
                                                                        fontSize: '11px',
                                                                        fontWeight: 600,
                                                                        cursor: 'pointer'
                                                                    }}
                                                                >
                                                                    Save
                                                                </button>
                                                            </div>
                                                        </form>
                                                    ) : (
                                                        <>
                                                            <div style={{ wordBreak: 'break-word', fontSize: '14px', lineHeight: '1.5' }}>{msg.content}</div>
                                                            <div style={{ fontSize: '10px', textAlign: 'right', marginTop: '6px', color: isOwnMessage ? '#a5b4fc' : '#94a3b8' }}>
                                                                {new Date(msg.CreatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        <div ref={messagesEndRef} />
                                    </div>
                                )}
                            </div>

                            <div style={{ padding: '18px 24px', background: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
                                <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '12px' }}>
                                    <input
                                        type="text"
                                        placeholder="Write a message..."
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        required
                                        style={{
                                            flex: 1,
                                            padding: '12px 16px',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '12px',
                                            fontSize: '14px',
                                            outline: 'none',
                                            background: '#f8fafc',
                                            transition: 'border-color 0.15s ease'
                                        }}
                                    />
                                    <button type="submit" style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '12px 20px',
                                        background: '#6366f1',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '14px'
                                    }}>
                                        Send
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="22" y1="2" x2="11" y2="13"></line>
                                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                        </svg>
                                    </button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#94a3b8' }}>
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ marginBottom: '16px' }}>
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Select a conversation to start messaging</h3>
                        </div>
                    )}
                </main>

            </div>

            {isProfileOpen && profile && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'rgba(15, 23, 42, 0.6)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'white',
                        padding: '28px',
                        borderRadius: '16px',
                        width: '380px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                        boxSizing: 'border-box'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Profile Settings</h3>
                            <button
                                onClick={() => setIsProfileOpen(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 0 }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Username (Unique)</label>
                                <input
                                    type="text"
                                    value={profile.username}
                                    disabled
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '10px',
                                        background: '#f1f5f9',
                                        color: '#64748b',
                                        fontSize: '14px',
                                        cursor: 'not-allowed',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Email Address</label>
                                <input
                                    type="email"
                                    value={profileEmail}
                                    onChange={(e) => setProfileEmail(e.target.value)}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '10px',
                                        background: '#ffffff',
                                        color: '#1e293b',
                                        fontSize: '14px',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            <button type="submit" style={{
                                width: '100%',
                                padding: '10px',
                                background: '#6366f1',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                marginTop: '8px'
                            }}>
                                Save Changes
                            </button>
                        </form>

                        {profileStatus && (
                            <p style={{
                                fontSize: '13px',
                                color: profileStatus.includes('success') ? '#10b981' : '#ef4444',
                                marginTop: '12px',
                                textAlign: 'center',
                                fontWeight: 500
                            }}>
                                {profileStatus}
                            </p>
                        )}

                        <div style={{ marginTop: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                            <button
                                onClick={handleDeleteAccount}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    background: 'none',
                                    border: '1px solid #fca5a5',
                                    color: '#ef4444',
                                    borderRadius: '10px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Delete Account
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}