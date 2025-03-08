from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.common.sql.operators.sql import SQLExecuteQueryOperator
from airflow.utils.dates import days_ago
from datetime import datetime, timedelta
import os
from pathlib import Path

# Import local modules
from netflix_elt_pipeline.tasks.extract_and_load import read_csv_and_load_table
from netflix_elt_pipeline.tasks.constants import DATABASE_URL, RAW_TABLE_NAME

# Function to read an SQL file
def read_sql_file(filepath):
    with open(filepath, "r") as file:
        return file.read()

# Define default arguments
default_args = {
    "owner": "airflow",
    "depends_on_past": False,
    "start_date": days_ago(1),
    "email_on_failure": False,
    "email_on_retry": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

# Define the DAG
dag = DAG(
    "netflix_elt_pipeline",
    default_args=default_args,
    description="Netflix titles ELT pipeline",
    schedule_interval="@daily",
    catchup=False,
    tags=["netflix", "elt"],
)

# Get the absolute paths
CSV_PATH = "/opt/airflow/resources/netflix_titles.csv"
CREATE_TABLES_SQL = "/opt/airflow/dags/sql/netflix_elt_pipeline/create_tables.sql"
DB_CREATION_SQL = "/opt/airflow/dags/sql/netflix_elt_pipeline/db_creation.sql"

# Read SQL files
create_tables_query = read_sql_file(CREATE_TABLES_SQL)
transform_query = read_sql_file(DB_CREATION_SQL)

# Define tasks
create_tables_task = SQLExecuteQueryOperator(
    task_id="create_tables",
    conn_id="my_postgres",
    sql=create_tables_query,
    autocommit=True,
    do_xcom_push=False,
    show_return_value_in_logs=True,
    split_statements=True,
    dag=dag,
)

load_task = PythonOperator(
    task_id="load_netflix_titles",
    python_callable=read_csv_and_load_table,
    op_kwargs={
        "table_name": RAW_TABLE_NAME,
        "source_path": CSV_PATH,
        "if_exists": "append",
        "database_url": DATABASE_URL,
    },
    dag=dag,
)

transform_task = SQLExecuteQueryOperator(
    task_id="transform_data",
    conn_id="my_postgres",
    sql=transform_query,
    autocommit=True,
    do_xcom_push=False,
    show_return_value_in_logs=True,
    split_statements=True,
    dag=dag,
)

# Set task dependencies
create_tables_task >> load_task >> transform_task

# Add documentation
dag.doc_md = """
# Netflix Titles ELT Pipeline

This DAG performs the Extract, Load, and Transform (ELT) operations for Netflix titles data.

## Tasks

1. **create_tables**: Creates the necessary tables in the database
2. **load_netflix_titles**: Loads the Netflix titles CSV data into the raw table
3. **transform_data**: Transforms the raw data according to the SQL transformation script

## Schedule
- Runs daily
- No catchup enabled
"""