import psycopg2

try:
    conn = psycopg2.connect(host='localhost', port=1234, user='postgres', password='karunakar', dbname='test')
    conn.autocommit = True
    cursor = conn.cursor()

    # 1. Create dislikes table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS dislikes (
            username VARCHAR(255),
            category VARCHAR(255),
            title TEXT,
            time VARCHAR(255)
        )
    ''')
    print("Dislikes table ensured.")
    
    # 2. Add weight to all user footprint tables
    cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
    tables = cursor.fetchall()
    for table in tables:
        t_name = table[0]
        if '@' in t_name: # user footprint tables are emails
            try:
                cursor.execute(f'ALTER TABLE "{t_name}" ADD COLUMN weight FLOAT DEFAULT 1.0')
                print(f"Added weight column to {t_name}")
            except Exception as e:
                pass # column likely already exists

    print("DB Migration Complete")
except Exception as e:
    print(f"Error: {e}")
