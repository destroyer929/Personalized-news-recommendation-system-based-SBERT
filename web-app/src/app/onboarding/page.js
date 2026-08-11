'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import './onboarding.css';

const categories = [
  { id: 'Technology', icon: '💻' },
  { id: 'Business', icon: '📈' },
  { id: 'Science', icon: '🔬' },
  { id: 'Sports', icon: '🏅' },
  { id: 'Entertainment', icon: '🎬' },
  { id: 'Health', icon: '🏥' },
  { id: 'Politics', icon: '⚖️' },
  { id: 'World', icon: '🌍' }
];

export default function OnboardingPage() {
  const [selected, setSelected] = useState([]);
  const [username, setUsername] = useState('');
  const router = useRouter();

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
      router.push('/');
    } else {
      setUsername(user);
    }
  }, [router]);

  const toggleCategory = (cat) => {
    setSelected(prev => 
      prev.includes(cat) 
        ? prev.filter(c => c !== cat)
        : [...prev, cat]
    );
  };

  const handleSubmit = async () => {
    if (selected.length === 0) return;
    
    try {
      const res = await fetch('/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, preferences: selected })
      });
      
      if (res.ok) {
        router.push('/home');
      }
    } catch (error) {
      console.error('Failed to save preferences');
    }
  };

  return (
    <div className="onboarding-container">
      <div className="particles">
        {/* Dynamic background elements */}
      </div>
      
      <div className="onboarding-content">
        <h1 className="title">Select Your Interests</h1>
        <p className="subtitle">Pick topics you love to personalize your news feed.</p>
        
        <div className="category-grid">
          {categories.map(cat => (
            <div 
              key={cat.id} 
              className={`category-card ${selected.includes(cat.id) ? 'selected' : ''}`}
              onClick={() => toggleCategory(cat.id)}
            >
              <div className="cat-icon">{cat.icon}</div>
              <div className="cat-name">{cat.id}</div>
              <div className="checkmark">✓</div>
            </div>
          ))}
        </div>
        
        <button 
          className="continue-btn" 
          disabled={selected.length === 0}
          onClick={handleSubmit}
        >
          Continue to Feed
        </button>
      </div>
    </div>
  );
}
