import grpc
from concurrent import futures
import time
import psycopg2
import pandas as pd
import numpy as np
from datetime import datetime
import os
import warnings
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestClassifier

# Import generated protobuf classes
import recommendation_pb2
import recommendation_pb2_grpc

# Suppress warnings
os.environ["OMP_NUM_THREADS"] = "1"
warnings.filterwarnings("ignore", module="sklearn")

print("Initializing SBERT Model (This will take a few seconds)...")
model = SentenceTransformer('all-MiniLM-L6-v2')
print("SBERT Model loaded successfully!")

def parse_iso_date(date_str):
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except:
        return None

def calculate_time_decay_weight(footprint, now):
    base_weight = footprint['weight']
    dt = parse_iso_date(footprint['time'])
    if not dt:
        return base_weight
    
    delta = now - dt.replace(tzinfo=None)
    days_ago = max(0, delta.total_seconds() / 86400)
    decay_factor = (0.95 ** days_ago)
    return base_weight * decay_factor

def get_user_data(username):
    footprints = []
    dislikes = []
    try:
        conn = psycopg2.connect(host='localhost', port=1234, user='postgres', password='karunakar', dbname='test')
        cursor = conn.cursor()
        
        try:
            cursor.execute(f'SELECT footprint, "time", weight FROM "{username}"')
            for row in cursor.fetchall():
                footprints.append({"text": row[0], "time": row[1], "weight": float(row[2]) if row[2] else 1.0})
        except Exception:
            conn.rollback()
            
        try:
            cursor.execute('SELECT category, title FROM saved_news WHERE username = %s', (username,))
            for row in cursor.fetchall():
                title = row[1] or ""
                if title:
                    footprints.append({"text": f"{row[0] or ''}: {title}", "time": datetime.utcnow().isoformat() + "Z", "weight": 3.0})
        except Exception:
            pass
            
        try:
            cursor.execute('SELECT category, title FROM dislikes WHERE username = %s', (username,))
            for row in cursor.fetchall():
                title = row[1] or ""
                if title:
                    dislikes.append(f"{row[0] or ''}: {title}")
        except Exception:
            pass
        
        cursor.close()
        conn.close()
        return footprints, dislikes
    except Exception as e:
        print(f"Database error: {e}")
        return [], []

def get_news_corpus():
    excel_path = 'englishnews.xlsx'
    if not os.path.exists(excel_path):
        excel_path = './news/englishnews.xlsx'
    df = pd.read_excel(excel_path)
    df.columns = df.columns.str.lower()
    return df

class RecommendationServicer(recommendation_pb2_grpc.RecommendationServiceServicer):
    def __init__(self):
        # Preload the corpus and embeddings to make requests lightning fast
        print("Preloading news corpus embeddings...")
        self.df = get_news_corpus()
        
        self.news_texts = []
        self.news_dates = []
        for _, row in self.df.iterrows():
            title = str(row.get('title', ''))
            desc = str(row.get('description', ''))
            cat = str(row.get('category', ''))
            self.news_texts.append(f"{cat}: {title}. {desc}")
            self.news_dates.append(row.get('date', ''))
            
        self.corpus_embeddings = model.encode(self.news_texts, show_progress_bar=False)
        print(f"Preloaded {len(self.news_texts)} articles.")

    def GetRecommendations(self, request, context):
        username = request.username
        print(f"\n[RPC] Received recommendation request for: {username}")
        
        footprints, dislikes = get_user_data(username)
        if not footprints:
            return recommendation_pb2.RecommendationResponse(success=False, message="No footprints found")

        # ---------------------------------------------------------
        # STAGE 1: CANDIDATE GENERATION (SBERT + K-Means + Cosine)
        # ---------------------------------------------------------
        footprint_texts = [f['text'] for f in footprints]
        footprint_embeddings = model.encode(footprint_texts, show_progress_bar=False)
        
        now = datetime.utcnow()
        weights = np.array([calculate_time_decay_weight(f, now) for f in footprints])
        if np.sum(weights) > 0:
            weights = weights / np.sum(weights)
        else:
            weights = np.ones(len(weights)) / len(weights)
            
        num_clusters = min(3, len(footprint_embeddings))
        if num_clusters >= 2:
            kmeans = KMeans(n_clusters=num_clusters, random_state=42, n_init=10)
            kmeans.fit(footprint_embeddings, sample_weight=weights)
            cluster_centers = kmeans.cluster_centers_
        else:
            cluster_centers = np.average(footprint_embeddings, weights=weights, axis=0).reshape(1, -1)
            
        dislike_embeddings = model.encode(dislikes, show_progress_bar=False) if dislikes else None

        similarities_to_clusters = cosine_similarity(self.corpus_embeddings, cluster_centers)
        max_similarities = np.max(similarities_to_clusters, axis=1)
        
        if dislike_embeddings is not None and len(dislike_embeddings) > 0:
            sim_to_dislikes = cosine_similarity(self.corpus_embeddings, dislike_embeddings)
            max_sim_to_dislikes = np.max(sim_to_dislikes, axis=1)
            max_similarities = max_similarities - (max_sim_to_dislikes * 0.5)

        # Get top 100 candidates for Stage 2
        top_100_indices = np.argsort(max_similarities)[::-1][:100]

        # ---------------------------------------------------------
        # STAGE 2: FEATURE ENGINEERING & RANKING MODEL (Random Forest)
        # ---------------------------------------------------------
        # We dynamically train a mini-ranker. Positive labels = footprint articles, Negative = random articles.
        # This simulates a production Learning-to-Rank (LTR) model.
        print(f"[RPC] Extracting features and training Random Forest Ranker for {username}...")
        
        # Build training set
        X_train = []
        y_train = []
        
        # Positive samples (Footprints)
        sim_features_pos = cosine_similarity(footprint_embeddings, cluster_centers)
        for i in range(len(footprint_embeddings)):
            X_train.append([sim_features_pos[i].max(), 0.0]) # recency penalty 0 for positive samples proxy
            y_train.append(1)
            
        # Negative samples (Random corpus articles with low similarity)
        low_sim_indices = np.argsort(max_similarities)[:len(footprint_embeddings)*2]
        for idx in low_sim_indices:
            dt = parse_iso_date(str(self.news_dates[idx]))
            days_old = max(0, (now - dt.replace(tzinfo=None)).total_seconds() / 86400) if dt else 30
            X_train.append([max_similarities[idx], days_old])
            y_train.append(0)

        # Train Ranker
        ranker = RandomForestClassifier(n_estimators=50, random_state=42)
        ranker.fit(X_train, y_train)

        # Score the top 100 candidates
        X_candidates = []
        for idx in top_100_indices:
            dt = parse_iso_date(str(self.news_dates[idx]))
            days_old = max(0, (now - dt.replace(tzinfo=None)).total_seconds() / 86400) if dt else 30
            X_candidates.append([max_similarities[idx], days_old])
            
        # Predict probability of being a "positive" interaction
        ranking_probs = ranker.predict_proba(X_candidates)[:, 1]
        
        # Final Top 10 sorted by ML ranking probability
        best_candidate_indices = np.argsort(ranking_probs)[::-1][:10]
        final_indices = [top_100_indices[i] for i in best_candidate_indices]

        # ---------------------------------------------------------
        # STAGE 3: BUILD RESPONSE
        # ---------------------------------------------------------
        response = recommendation_pb2.RecommendationResponse(success=True, message="Success")
        
        for idx in final_indices:
            row = self.df.iloc[idx]
            # Get the original similarity score to display
            orig_sim = max_similarities[idx]
            
            # Avoid showing items already in footprint perfectly
            footprint_texts_set = set(f['text'].lower() for f in footprints)
            combined_text = f"{row.get('category','')}: {row.get('title','')}".lower()
            if any(f_text in combined_text for f_text in footprint_texts_set):
                continue
                
            article = recommendation_pb2.Article(
                title=str(row.get('title', '')),
                date=str(row.get('date', '')),
                source=str(row.get('source', '')),
                link=str(row.get('link', '')),
                image=str(row.get('image', '')),
                content=str(row.get('content', '')),
                author=str(row.get('author', '')),
                category=str(row.get('category', '')),
                score=float(orig_sim)
            )
            response.recommendations.append(article)

        print(f"[RPC] Successfully generated {len(response.recommendations)} ranked recommendations.")
        return response

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    recommendation_pb2_grpc.add_RecommendationServiceServicer_to_server(RecommendationServicer(), server)
    server.add_insecure_port('[::]:50051')
    print("gRPC Recommendation Server listening on port 50051...")
    server.start()
    server.wait_for_termination()

if __name__ == '__main__':
    serve()
