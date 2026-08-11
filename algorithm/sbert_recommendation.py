import pandas as pd
import psycopg2
import sys
import json
import os
import numpy as np
import random
from datetime import datetime
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import KMeans
import warnings

# Suppress KMeans memory leak warning on Windows
os.environ["OMP_NUM_THREADS"] = "1"
warnings.filterwarnings("ignore", module="sklearn.cluster")

def parse_iso_date(date_str):
    if not date_str:
        return None
    try:
        # Handles 2026-08-11T12:00:00.000Z or similar
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except:
        return None

def get_user_data(username):
    footprints = []
    dislikes = []
    
    try:
        conn = psycopg2.connect(host='localhost', port=1234, user='postgres', password='karunakar', dbname='test')
        cursor = conn.cursor()
        
        # 1. Get from regular footprints
        try:
            sql = f'SELECT footprint, "time", weight FROM "{username}"'
            cursor.execute(sql)
            rows = cursor.fetchall()
            for row in rows:
                footprints.append({
                    "text": row[0],
                    "time": row[1],
                    "weight": float(row[2]) if row[2] is not None else 1.0
                })
        except Exception as e:
            print(f"No footprint table or error: {e}")
            conn.rollback()
            
        # 2. Get from saved_news (Treat as high weight footprint)
        try:
            sql = 'SELECT category, title FROM saved_news WHERE username = %s'
            cursor.execute(sql, (username,))
            saved_rows = cursor.fetchall()
            for row in saved_rows:
                cat = row[0] or ""
                title = row[1] or ""
                if title:
                    footprints.append({
                        "text": f"{cat}: {title}",
                        "time": datetime.utcnow().isoformat() + "Z", # assume saved is fresh
                        "weight": 3.0 # Saved is a strong signal
                    })
        except Exception as e:
            print(f"Error fetching saved news: {e}")
            
        # 3. Get Dislikes
        try:
            sql = 'SELECT category, title FROM dislikes WHERE username = %s'
            cursor.execute(sql, (username,))
            dislike_rows = cursor.fetchall()
            for row in dislike_rows:
                cat = row[0] or ""
                title = row[1] or ""
                if title:
                    dislikes.append(f"{cat}: {title}")
        except Exception as e:
            print(f"Error fetching dislikes: {e}")
        
        cursor.close()
        conn.close()
        
        return footprints, dislikes
    except Exception as e:
        print(f"Database error for user {username}: {e}")
        return [], []

def calculate_time_decay_weight(footprint, now):
    base_weight = footprint['weight']
    dt = parse_iso_date(footprint['time'])
    if not dt:
        return base_weight
    
    # Calculate days ago
    delta = now - dt.replace(tzinfo=None)
    days_ago = max(0, delta.total_seconds() / 86400)
    
    # 5% decay per day: (0.95 ^ days_ago)
    decay_factor = (0.95 ** days_ago)
    
    return base_weight * decay_factor

def main():
    if len(sys.argv) < 2:
        print("Usage: python sbert_recommendation.py <username>")
        sys.exit(1)
        
    username = sys.argv[1]
    print(f"Running SBERT recommendation for user: {username}")
    
    # 1. Load user footprints & dislikes
    footprints_data, dislikes = get_user_data(username)
    if not footprints_data:
        print(f"No footprints found for user {username}. Cannot calculate similarity.")
        sys.exit(0)
        
    print(f"Found {len(footprints_data)} footprints and {len(dislikes)} dislikes for user {username}")
    
    # 2. Load the news corpus
    try:
        excel_path = 'englishnews.xlsx'
        if not os.path.exists(excel_path):
            excel_path = './news/englishnews.xlsx'
        df = pd.read_excel(excel_path)
    except Exception as e:
        print(f"Error loading news corpus: {e}")
        sys.exit(1)
        
    df.columns = df.columns.str.lower()
    
    if 'title' not in df.columns:
        print("Error: News corpus missing 'title' column.")
        sys.exit(1)
        
    news_texts = []
    news_dates = []
    for _, row in df.iterrows():
        title = str(row['title']) if pd.notna(row.get('title')) else ""
        desc = str(row['description']) if 'description' in df.columns and pd.notna(row['description']) else ""
        category = str(row['category']) if 'category' in df.columns and pd.notna(row['category']) else ""
        
        combined_text = f"{category}: {title}. {desc}"
        news_texts.append(combined_text)
        news_dates.append(row.get('date', ''))
        
    # 3. Generate Embeddings
    print("Loading SentenceTransformer model (all-MiniLM-L6-v2)...")
    model = SentenceTransformer('all-MiniLM-L6-v2')
    
    print("Generating embeddings for news corpus...")
    corpus_embeddings = model.encode(news_texts, show_progress_bar=False)
    
    print("Generating embeddings for user footprints...")
    footprint_texts = [f['text'] for f in footprints_data]
    footprint_embeddings = model.encode(footprint_texts, show_progress_bar=False)
    
    # Calculate exponential time decay weights
    now = datetime.utcnow()
    weights = np.array([calculate_time_decay_weight(f, now) for f in footprints_data])
    
    # Normalize weights so they sum to 1
    if np.sum(weights) > 0:
        weights = weights / np.sum(weights)
    else:
        weights = np.ones(len(weights)) / len(weights)
        
    # 4. Multi-Vector Clustering (K-Means)
    num_clusters = min(3, len(footprint_embeddings)) # Max 3 clusters
    if num_clusters >= 2:
        print(f"Clustering footprints into {num_clusters} distinct interest vectors...")
        kmeans = KMeans(n_clusters=num_clusters, random_state=42, n_init=10)
        kmeans.fit(footprint_embeddings, sample_weight=weights)
        cluster_centers = kmeans.cluster_centers_
    else:
        # Fallback to weighted average if not enough footprints
        cluster_centers = np.average(footprint_embeddings, weights=weights, axis=0).reshape(1, -1)
        
    # 5. Negative Penalty (Dislikes)
    dislike_embeddings = None
    if dislikes:
        print(f"Generating embeddings for {len(dislikes)} dislikes...")
        dislike_embeddings = model.encode(dislikes, show_progress_bar=False)
    
    # 6. Calculate Similarity against all cluster centers
    print("Calculating cosine similarity...")
    similarities_to_clusters = cosine_similarity(corpus_embeddings, cluster_centers)
    max_similarities = np.max(similarities_to_clusters, axis=1) # shape: (len(corpus),)
    
    # Apply Negative Penalty
    if dislike_embeddings is not None and len(dislike_embeddings) > 0:
        sim_to_dislikes = cosine_similarity(corpus_embeddings, dislike_embeddings)
        max_sim_to_dislikes = np.max(sim_to_dislikes, axis=1)
        # Penalize
        max_similarities = max_similarities - (max_sim_to_dislikes * 0.5)
        
    # 7. Hybrid Freshness Scoring
    final_scores = np.zeros(len(corpus_embeddings))
    for i, sim_score in enumerate(max_similarities):
        date_str = news_dates[i]
        dt = parse_iso_date(str(date_str))
        freshness = 0.5 # Default middle freshness
        
        if dt:
            delta = now - dt.replace(tzinfo=None)
            days_old = max(0, delta.total_seconds() / 86400)
            freshness = max(0.0, 1.0 - (days_old / 30.0))
            
        # 85% Relevance, 15% Freshness
        final_scores[i] = (sim_score * 0.85) + (freshness * 0.15)
        
    # 8. Serendipity Injection & Final Selection
    top_indices = final_scores.argsort()[-350:][::-1]
    
    recommendations = []
    seen_ids = set()
    
    for idx in top_indices:
        idx = int(idx)
        if idx in seen_ids: continue
        
        # Every 15th article, inject serendipity (a random fresh article)
        if len(recommendations) > 0 and len(recommendations) % 15 == 0:
            random_idx = random.randint(0, len(corpus_embeddings) - 1)
            while random_idx in seen_ids:
                random_idx = random.randint(0, len(corpus_embeddings) - 1)
                
            seen_ids.add(random_idx)
            article = df.iloc[random_idx].to_dict()
            clean_article = {k: (v if pd.notna(v) else "") for k, v in article.items()}
            clean_article['id'] = random_idx
            clean_article['similarity_score'] = float(final_scores[random_idx])
            clean_article['is_discovery'] = True
            recommendations.append(clean_article)
            
        seen_ids.add(idx)
        article = df.iloc[idx].to_dict()
        clean_article = {k: (v if pd.notna(v) else "") for k, v in article.items()}
        clean_article['id'] = idx
        clean_article['similarity_score'] = float(final_scores[idx])
        
        recommendations.append(clean_article)
        if len(recommendations) >= 300:
            break
            
    # 9. Save Recommendations
    output_dir = 'recommendations'
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    output_file = os.path.join(output_dir, f"{username}.json")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(recommendations, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully saved {len(recommendations)} recommendations to {output_file}")

if __name__ == '__main__':
    main()
