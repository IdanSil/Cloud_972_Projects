from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator

def hello_world():
    print("Hello, Apache Airflow!")

default_args = {
    'owner': 'Idan',
    'depends_on_past': False,
    'start_date': datetime(2024, 3, 6),
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

dag = DAG(
    'hello_airflow',
    default_args=default_args,
    description='A simple DAG',
    schedule_interval=timedelta(days=1),
)

task = PythonOperator(
    task_id='say_hello',
    python_callable=hello_world,
    dag=dag,
)