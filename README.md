# Personalized News Recommendation System (SBERT Model)

A full-stack, machine-learning-powered news recommendation engine designed to provide users with a highly personalized news feed based on a deep semantic understanding of their reading history.

## 🚀 Key Features

* **SBERT Semantic Recommendations**: Utilizes state-of-the-art Sentence-BERT models to analyze the underlying semantic meaning of articles you read, generating highly accurate and relevant recommendations tailored specifically to your interests.
* **Modern Web Interface**: A sleek, responsive, and beautiful frontend built with Next.js and React.
* **"My Brain" Analytics Dashboard**: Visualize your reading habits with interactive charts tracking your top topics, favorite news sources, and recent reading history.
* **Interactive News Feed**: Save articles for later reading, dislike articles to dynamically train the algorithm to hide similar content, and track your reading footprint.
* **Dark & Light Mode**: Seamlessly toggle between a vibrant Light Mode and a sleek Dark Mode.
* **User Authentication**: Secure user registration and login system with persistent profiles.

## 🛠️ Technology Stack

* **Frontend**: Next.js, React, Recharts (for analytics visualizations), CSS3
* **Backend**: Next.js API Routes (Node.js)
* **Machine Learning**: Python, PyTorch, Sentence-Transformers (SBERT), Pandas, Scikit-learn
* **Database**: PostgreSQL
* **Data Pipelines**: Python (Requests, BeautifulSoup for crawling)

## 📁 Project Structure

* `/web-app`: Contains the complete Next.js full-stack application, including the UI, API routes, and styling.
* `/algorithm`: Contains the Python machine learning scripts, data migration tools, and web crawlers used to populate the database and generate daily recommendations.

## ⚙️ Setup & Installation

### 1. Database Setup
1. Ensure PostgreSQL is running locally on port `1234`.
2. Create a database named `test`.
3. Run the `algorithm/db_migration.py` script to initialize the required tables.

### 2. Machine Learning Engine
Navigate to the `algorithm` directory and install the required Python packages (e.g., PyTorch, sentence-transformers, psycopg2). Run the recommendation engine to compute similarities:
```bash
cd algorithm
python sbert_recommendation.py
```

### 3. Web Application
Navigate to the `web-app` directory and install the Node dependencies:
```bash
cd web-app
npm install
npm run dev
```
The application will be available at `http://localhost:3000`.
