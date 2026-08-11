'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import './home.css';

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

export default function HomePage() {
  const [username, setUsername] = useState('');
  const [news, setNews] = useState([]);
  const [savedLinks, setSavedLinks] = useState(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [isFetchingLive, setIsFetchingLive] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [dislikedLinks, setDislikedLinks] = useState(new Set());
  
  const observer = useRef();
  const clickTracker = useRef({ activeArticle: null, startTime: null });
  const router = useRouter();

  const loadNews = async (user, pageNum, refresh = false) => {
    if (isLoading || (!hasMore && !refresh)) return;
    setIsLoading(true);
    
    try {
      const res = await fetch(`/api/news?username=${encodeURIComponent(user)}&page=${pageNum}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        if (refresh) {
          setNews(data.news);
        } else {
          setNews(prev => {
            // filter duplicates just in case
            const existingIds = new Set(prev.map(n => n.id));
            const newNews = data.news.filter(n => !existingIds.has(n.id));
            return [...prev, ...newNews];
          });
        }
        setHasMore(data.hasMore);
      }
    } catch (error) {
      console.error("Failed to load news feed", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
      router.push('/');
    } else {
      setUsername(user);
      
      const fetchSaved = async () => {
        try {
          const res = await fetch(`/api/user/saved?username=${encodeURIComponent(user)}`);
          if (res.ok) {
            const data = await res.json();
            const links = new Set(data.saved.map(article => article.link));
            setSavedLinks(links);
          }
        } catch (error) {
          console.error("Failed to load saved news", error);
        }
      };
      
      fetchSaved();
      loadNews(user, 1, true);
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

  useEffect(() => {
    const handleFocus = () => {
      if (clickTracker.current.activeArticle && clickTracker.current.startTime) {
        const elapsed = (Date.now() - clickTracker.current.startTime) / 1000;
        // Strong footprint if they spent > 15 seconds reading
        const weight = elapsed > 15 ? 3.0 : 1.0;
        
        fetch('/api/user/footprint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            articleTitle: clickTracker.current.activeArticle.title,
            category: clickTracker.current.activeArticle.category,
            weight
          })
        });
        
        // Reset the tracker so we don't double log
        clickTracker.current = { activeArticle: null, startTime: null };
      }
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [username]);

  const handleLiveFetch = async () => {
    if (isFetchingLive) return;
    setIsFetchingLive(true);
    
    try {
      const res = await fetch('/api/ml/fetch-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      
      if (res.ok) {
        // Fetch the new recommendations and append the fresh articles to the bottom
        await loadNews(username, 1, false);
        // Also fetch page 2 to ensure we get enough new unseen articles appended
        await loadNews(username, 2, false);
      }
    } catch (error) {
      console.error('Failed to fetch live updates:', error);
    } finally {
      setIsFetchingLive(false);
    }
  };

  const lastElementRef = useCallback(node => {
    if (isLoading || isFetchingLive) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        if (hasMore) {
          setPage(prevPage => {
            const next = prevPage + 1;
            loadNews(username, next, false);
            return next;
          });
        }
      }
    });
    
    if (node) observer.current.observe(node);
  }, [isLoading, hasMore, username, isFetchingLive]);

  const handleRefresh = async () => {
    if (!username || isRefreshing) return;
    setIsRefreshing(true);
    setPage(1);
    
    try {
      // Trigger ML algorithm to recalculate recommendations
      await fetch('/api/ml/run', { method: 'POST', body: JSON.stringify({ username }) });
      // Reload news feed page 1
      await loadNews(username, 1, true);
    } catch (error) {
      console.error("Failed to refresh recommendations", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleArticleClick = (article, e) => {
    // Start dwell time tracker! We will log the footprint when they return to this window.
    clickTracker.current = { activeArticle: article, startTime: Date.now() };
  };
  
  const handleDislike = async (article, e) => {
    e.preventDefault();
    const link = article.link || article.url;
    
    setDislikedLinks(prev => {
      const newSet = new Set(prev);
      newSet.add(link);
      return newSet;
    });

    try {
      await fetch('/api/user/dislike', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          articleTitle: article.title,
          category: article.category
        })
      });
      fetch('/api/ml/run', { method: 'POST', body: JSON.stringify({ username }) });
    } catch (error) {
      console.error('Failed to log dislike', error);
    }
  };

  const handleToggleSave = async (article, e) => {
    e.preventDefault(); // Prevent navigating to the link
    const link = article.link || article.url;
    const isSaved = savedLinks.has(link);
    
    // Optimistic UI update
    setSavedLinks(prev => {
      const newSet = new Set(prev);
      if (isSaved) {
        newSet.delete(link);
      } else {
        newSet.add(link);
      }
      return newSet;
    });

    try {
      if (isSaved) {
        await fetch(`/api/user/saved?username=${encodeURIComponent(username)}&link=${encodeURIComponent(link)}`, {
          method: 'DELETE'
        });
      } else {
        await fetch('/api/user/saved', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, article })
        });
        // Trigger background ML fetch based on saved article!
        fetch('/api/ml/run', { method: 'POST', body: JSON.stringify({ username }) });
      }
    } catch (error) {
      console.error('Failed to save/unsave article', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/');
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setActiveSearch('');
      return;
    }
    
    setActiveSearch(searchQuery);
    
    // Log the search as a footprint to train the algorithm!
    try {
      await fetch('/api/user/footprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          articleTitle: searchQuery,
          category: 'Search'
        })
      });
      // We don't trigger ML immediately because we want instant gratification 
      // by filtering locally, and the ML will run on the next natural refresh.
    } catch (err) {
      console.error('Failed to log search footprint', err);
    }
  };

  const displayedNews = activeSearch 
    ? news.filter(article => 
        (article.title && article.title.toLowerCase().includes(activeSearch.toLowerCase())) || 
        (article.description && article.description.toLowerCase().includes(activeSearch.toLowerCase())) ||
        (article.category && article.category.toLowerCase().includes(activeSearch.toLowerCase()))
      )
    : news;

  return (
    <div className="home-container">
      <nav className="navbar glass">
        <div className="nav-brand">News</div>
        
        <form onSubmit={handleSearchSubmit} className="nav-search-form">
          <input 
            type="text" 
            className="search-input glass" 
            placeholder="Search news..." 
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value === '') setActiveSearch('');
            }}
          />
          <button type="submit" className="search-btn glass">🔍</button>
        </form>

        <div className="nav-actions">
          <button 
            className={`nav-btn ${isRefreshing ? 'refreshing' : ''}`} 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh Feed'}
          </button>
        </div>
        <div className="nav-profile">
          <span className="username">Welcome, {username}</span>
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
            <button className="nav-btn" onClick={() => router.push('/saved')}>Saved</button>
          </div>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <main className="feed-container">
        <header className="feed-header">
          <h1 className="feed-title">Your Personalized Feed</h1>
          <p className="feed-subtitle">Curated based on your interests and reading habits.</p>
        </header>

        <div className="news-grid">
          {displayedNews.map((article, index) => {
            const link = article.link || article.url;
            if (dislikedLinks.has(link)) return null;
            
            const isSaved = savedLinks.has(link);
            const isLast = index === displayedNews.length - 1;
            const isFeatured = index === 0 && !activeSearch;
            
            return (
              <article 
                key={article.id || link || index} 
                className={`news-card glass hoverable ${isFeatured ? 'featured-article' : ''}`}
                ref={isLast ? lastElementRef : null}
              >
                <button 
                  className="dislike-btn"
                  onClick={(e) => handleDislike(article, e)}
                  title="Not Interested"
                >
                  ✕
                </button>
                {article.image && (
                  <div className="news-image-container">
                    <img src={article.image} alt={article.title} className="news-image" />
                  </div>
                )}
                <button 
                  className={`heart-btn ${isSaved ? 'saved' : ''}`}
                  onClick={(e) => handleToggleSave(article, e)}
                  title={isSaved ? "Unsave Article" : "Save Article"}
                >
                  {isSaved ? '❤️' : '🤍'}
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
                    href={link || '#'} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="read-more" 
                    style={{textAlign: 'center', textDecoration: 'none', display: 'block'}}
                    onClick={(e) => handleArticleClick(article, e)}
                  >
                    Read Full Story
                  </a>
                </div>
              </article>
            );
          })}
        </div>
        
        {isLoading && !isFetchingLive && !activeSearch && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            Loading more recommendations...
          </div>
        )}
        
        {isFetchingLive && !activeSearch && (
          <div className="loading-indicator" style={{ padding: '60px 0' }}>
            <div className="spinner" style={{ borderColor: 'rgba(239, 68, 68, 0.2)', borderTopColor: '#ef4444' }}></div>
            <p style={{ color: '#ef4444', fontWeight: 'bold' }}>Searching the web for live updates...</p>
            <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>This takes about 10-15 seconds</p>
          </div>
        )}
        
        {!hasMore && news.length > 0 && !isFetchingLive && !activeSearch && (
          <div className="end-message" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <p>You're all caught up!</p>
            <button className="nav-btn glass hoverable" onClick={handleLiveFetch} style={{ margin: '0', padding: '12px 24px' }}>
              Search Web for Live Updates
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
