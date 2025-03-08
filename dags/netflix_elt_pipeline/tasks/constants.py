# Database credentials
DB_USER = "etl_user"
DB_PASSWORD = "etl_password"
DB_HOST = "etl_db"  # Docker service name
DB_PORT = "5432"  # Internal container port
DB_NAME = "etl_database"

# Construct the database URL
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
RAW_TABLE_NAME = "netflix_raw"