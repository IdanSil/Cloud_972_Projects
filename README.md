# Cloud_972_Projects

Some of my personal work, will be adding cool Data Engineering Projects to learn from and re-create.

## Netflix ELT Pipeline with Apache Airflow

This project implements an ELT (Extract, Load, Transform) pipeline for Netflix titles data using Apache Airflow and PostgreSQL.

### Project Structure

```
.
├── dags/
│   ├── netflix_elt_pipeline/
│   │   └── tasks/
│   │       ├── constants.py
│   │       └── extract_and_load.py
│   ├── sql/
│   │   └── netflix_elt_pipeline/
│   │       ├── create_tables.sql
│   │       ├── data_analysis.sql
│   │       └── db_creation.sql
│   └── netflix_elt_pipeline.py
├── resources/
│   └── netflix_titles.csv
├── docker-compose.yaml
├── dockerfile
└── requirements.txt
```

### Pipeline Steps

1. **Create Tables**: Creates the initial raw table structure
2. **Load Data**: Loads data from CSV file into the raw table
3. **Transform Data**: Performs data transformations including:
   - Deduplication
   - Splitting multiple-valued columns into separate tables
   - Creating a master data table
   - Handling missing values

### Setup

1. Clone the repository:
```bash
git clone https://github.com/IdanSil/Cloud_972_Projects.git
cd Cloud_972_Projects/Netflix_ELT
```

2. Start the containers:
```bash
docker-compose up --build
```

3. Access Airflow UI:
- URL: http://localhost:8080
- Username: airflow
- Password: airflow

### Database Schema

#### Raw Table
- `netflix_raw`: Initial data loaded from CSV

#### Transformed Tables
- `netflix`: Master data table with deduplicated records
- `netflix_directors`: Directors information
- `netflix_cast`: Cast information
- `netflix_countries`: Countries information
- `netflix_genres`: Genres information

### Technologies Used

- Apache Airflow
- PostgreSQL
- Docker
- Python
- SQL
