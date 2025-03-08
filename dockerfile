# Use the official Airflow image
FROM apache/airflow:latest

# Copy requirements.txt into the container
COPY requirements.txt /requirements.txt

# Install dependencies
RUN pip install --no-cache-dir -r /requirements.txt