'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import './saved.css';

const timeAgo = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return 'Just now';
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
  
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  
  const years = Math.floor(days / 365);
  return `${years} year${years > 1 ? 's' : ''} ago`;
};

export default function SavedPage() {
  const [username, setUsername] = useState('');
  const [savedNews, setSavedNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState('dark');
  const router = useRouter();

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
      router.push('/');
    } else {
      setUsername(user);
      fetchSaved(user);
    }
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

  const fetchSaved = async (user) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/user/saved?username=${encodeURIComponent(user)}`);
      if (res.ok) {
        const data = await res.json();
        setSavedNews(data.saved);
      }
    } catch (error) {
      console.error('Failed to fetch saved articles', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnsave = async (link, e) => {
    e.preventDefault();
    
    // Optimistic UI update
    setSavedNews(prev => prev.filter(article => article.link !== link));

    try {
      await fetch(`/api/user/saved?username=${encodeURIComponent(username)}&link=${encodeURIComponent(link)}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Failed to unsave article', error);
      // Refresh to restore state on failure
      const res = await fetch(`/api/user/saved?username=${encodeURIComponent(username)}`);
      if (res.ok) {
        const data = await res.json();
        setSavedNews(data);
      }
    }
  };

  return (
    <div className="saved-container">
      <nav className="navbar glass">
        <div className="nav-brand">Saved</div>
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
          <button className="nav-btn" onClick={() => router.push('/profile')}>My Brain 🧠</button>
          <button className="nav-btn" onClick={() => router.push('/home')}>Back to Home</button>
        </div>
      </nav>

      <main className="feed-container">
        <header className="feed-header">
          <h1 className="feed-title">Your Saved Articles</h1>
          <p className="feed-subtitle">
            {savedNews.length === 0 && !loading 
              ? "You haven't saved any articles yet. Head back to your feed to find something interesting!"
              : "A personalized collection of your favorite reads."
            }
          </p>
        </header>

        {loading ? (
          <div className="loading">Loading your collection...</div>
        ) : (
          <div className="news-grid">
            {savedNews.map(article => (
              <article key={article.id} className="news-card glass hoverable">
                {article.image && (
                  <div className="news-image-container">
                    <img src={article.image} alt={article.title} className="news-image" />
                  </div>
                )}
                <button 
                  className="heart-btn saved"
                  onClick={(e) => handleUnsave(article.link, e)}
                  title="Remove from saved"
                >
                  ❤️
                </button>
                <div className="news-content">
                  <div className="news-meta">
                  <span className="news-category">{article.category}</span>
                  <span className="news-date">{timeAgo(article.date)}</span>
                </div>
                  <h2 className="news-title">{article.title}</h2>
                  <p className="news-excerpt">
                    {article.description || `Dive into the latest updates regarding ${article.title.toLowerCase()}.`}
                  </p>
                  <a 
                    href={article.link || '#'} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="read-more" 
                    style={{textAlign: 'center', textDecoration: 'none', display: 'block'}}
                  >
                    Read Full Story
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
