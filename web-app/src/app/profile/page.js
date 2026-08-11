'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip 
} from 'recharts';
import './profile.css';

const COLORS = [
  '#d4af37', // Gold
  '#8B9D83', // Sage
  '#6B7A8F', // Slate Blue
  '#D9A05B', // Warm Bronze
  '#A37C40', // Deep Ochre
  '#C1C8C7'  // Platinum
];

export default function Profile() {
  const [username, setUsername] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState('dark');
  const router = useRouter();

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
      router.push('/');
      return;
    }
    setUsername(user);
    fetchAnalytics(user);
  }, [router]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    if (savedTheme === 'light') {
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.remove('theme-light');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'light') {
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.remove('theme-light');
    }
  };

  const fetchAnalytics = async (user) => {
    try {
      const res = await fetch(`/api/user/analytics?username=${encodeURIComponent(user)}`);
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to load analytics', error);
    } finally {
      setLoading(false);
    }
  };

  // Determine chart colors based on theme
  const textColor = theme === 'dark' ? '#f3f4f6' : '#1a1a1a';
  const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  return (
    <div className="profile-container">
      <nav className="navbar glass">
        <div className="nav-brand">My Brain</div>
        <div className="nav-actions">
          <div className="theme-switch-wrapper" onClick={toggleTheme} title="Toggle Theme">
            <div className="theme-switch">
              <div className="theme-switch-circle">
                {theme === 'dark' ? '🌙' : '🌞'}
              </div>
            </div>
            <span className="theme-switch-label">
              {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </span>
          </div>
          <button className="nav-btn" onClick={() => router.push('/saved')}>Saved</button>
          <button className="nav-btn" onClick={() => router.push('/home')}>Back to Home</button>
        </div>
      </nav>

      <div className="content-container">
        <header className="header">
          <h1 className="title">Your Digital Mind</h1>
          <p className="subtitle">
            A visual breakdown of your interests, powered by Multi-Vector SBERT clustering.
          </p>
        </header>

        {loading ? (
          <div className="loading">Analyzing neural pathways...</div>
        ) : !analytics || !analytics.data || analytics.data.length === 0 ? (
          <div className="empty-state">
            <p>We don't have enough data yet.</p>
            <p style={{marginTop: '10px', fontSize: '1rem'}}>Go read or save some articles to train your AI!</p>
          </div>
        ) : (
          <div className="dashboard-grid">
            <div className="chart-card glass">
              <h2 className="chart-title">Interest Radar</h2>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={analytics.data}>
                  <PolarGrid stroke={gridColor} />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: textColor, fontSize: 12, fontFamily: 'Playfair Display' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name={username} dataKey="score" stroke="#d4af37" strokeWidth={2} fill="#d4af37" fillOpacity={0.65} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--accent-gold)', borderRadius: '4px', color: textColor }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card glass">
              <h2 className="chart-title">Topic Breakdown</h2>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={analytics.data}
                    cx="50%"
                    cy="50%"
                    innerRadius={100}
                    outerRadius={160}
                    paddingAngle={3}
                    dataKey="score"
                    nameKey="subject"
                  >
                    {analytics.data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--accent-gold)', borderRadius: '4px', color: textColor }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
