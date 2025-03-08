import pandas as pd
from sqlalchemy import create_engine
from netflix_elt_pipeline.tasks.constants import DATABASE_URL, RAW_TABLE_NAME

def read_csv_and_load_table(table_name, source_path, if_exists, database_url=DATABASE_URL):
    """
    This function creates a new table in a SQL database
    :param database_url: connection url to the Database
    :param table_name: The new name for the created table, for example "my_table"
    :param source_path: the path to the csv dataset
    :param if_exists: append, replace, fail
    """
    engine = create_engine(database_url)
    df = pd.read_csv(source_path)
    # Load DataFrame into PostgreSQL table
    df.to_sql(table_name, engine, if_exists=if_exists, index=False)
    print("DataFrame successfully loaded into PostgreSQL!")


