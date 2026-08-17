import requests
import pandas as pd
import json
import os
import time

def get_newsapi_data(api_key, category, is_keyword=False):
    """Fetches news articles using NewsAPI."""
    if is_keyword:
        # Use 'everything' endpoint for keywords like Politics and World
        url = f"https://newsapi.org/v2/everything?q={category}&sortBy=popularity&language=en&apiKey={api_key}"
    else:
        # Use 'top-headlines' endpoint for standard categories
        url = f"https://newsapi.org/v2/top-headlines?country=us&category={category.lower()}&apiKey={api_key}"
        
    try:
        response = requests.get(url, timeout=10)
        data = response.json()
        
        if data.get('status') != 'ok':
            print(f"API Error for {category}: {data.get('message')}")
            return []
            
        articles = data.get('articles', [])
        print(f"Found {len(articles)} articles for category: {category}")
        
        content = []
        for article in articles:
            if article.get('title') == '[Removed]' or not article.get('content'):
                continue
                
            result = {
                'title': article.get('title', ''),
                'date': article.get('publishedAt', ''),
                'source': article.get('source', {}).get('name', 'NewsAPI'),
                'link': article.get('url', ''),
                'image': article.get('urlToImage', ''),
                'content': f"{article.get('description', '')}\n{article.get('content', '')}",
                'author': article.get('author', '') or 'Unknown',
                'category': category.capitalize()
            }
            content.append(result)
            
        return content
    except Exception as e:
        print(f"Error fetching from NewsAPI for {category}: {e}")
        return []

if __name__ == "__main__":
    import concurrent.futures

    print("Starting English news crawler (NewsAPI) with Multi-threading...")
    API_KEY = "10063597173a4b89bfd653733c0f57d6"
    
    # Categories from Next.js Onboarding
    standard_categories = ['Technology', 'Business', 'Science', 'Sports', 'Entertainment', 'Health']
    keyword_categories = ['Politics', 'World']
    
    all_news_data = []
    
    # Define worker function
    def fetch_category(cat_info):
        cat, is_keyword = cat_info
        return get_newsapi_data(API_KEY, cat, is_keyword=is_keyword)

    # Prepare tasks
    tasks = [(cat, False) for cat in standard_categories] + [(cat, True) for cat in keyword_categories]

    # Execute with ThreadPoolExecutor
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        # We use map to run tasks concurrently
        results = executor.map(fetch_category, tasks)
        
        for news in results:
            if news:
                all_news_data.extend(news)
    
    if all_news_data:
        df = pd.DataFrame(all_news_data)
        os.makedirs('./news', exist_ok=True)
        filename = './news/englishnews.xlsx'
        df.to_excel(filename, index=False)
        # Also copy to root for compatibility with older paths if needed
        df.to_excel('./englishnews.xlsx', index=False)
        print(f"Successfully scraped {len(all_news_data)} total articles and saved to {filename}")
    else:
        print("No news data scraped.")
