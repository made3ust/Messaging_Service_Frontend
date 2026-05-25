import React, { useState, useEffect } from 'react';
import api from './api';
import Dashboard from './Dashboard';

function App() {
  const [isLoginView, setIsLoginView] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setMessage('');
    setError('');
  }, [isLoginView]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    try {
      await api.post('/register', { username, email, password });
      setMessage('Registration successful! You can now log in.');
      setIsLoginView(true);
      setPassword('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    try {
      const response = await api.post('/login', { username, password });
      const receivedToken = response.data.token;

      localStorage.setItem('token', receivedToken);
      setToken(receivedToken);
      setMessage('Logged in successfully!');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid username or password');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setMessage('Logged out successfully.');
  };

  if (token) {
    return <Dashboard onLogout={handleLogout} />;
  }

  return (
      <div style={{ maxWidth: '400px', margin: '50px auto', fontFamily: 'Arial, sans-serif' }}>
        <h2>{isLoginView ? 'Sign In' : 'Create Account'}</h2>

        <form onSubmit={isLoginView ? handleLogin : handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Username:</label>
            <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>

          {!isLoginView && (
              <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>Email Address:</label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                />
              </div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Password:</label>
            <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>

          <button type="submit" style={{ padding: '10px', background: '#007bff', color: 'white', border: 'none', cursor: 'pointer' }}>
            {isLoginView ? 'Login' : 'Register'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button
              onClick={() => setIsLoginView(!isLoginView)}
              style={{ background: 'none', border: 'none', color: '#007bff', textDecoration: 'underline', cursor: 'pointer' }}
          >
            {isLoginView ? "Don't have an account? Register here" : 'Already have an account? Login here'}
          </button>
        </div>

        {message && <p style={{ color: 'green', marginTop: '15px', textAlign: 'center' }}>{message}</p>}
        {error && <p style={{ color: 'red', marginTop: '15px', textAlign: 'center' }}>{error}</p>}
      </div>
  );
}

export default App;