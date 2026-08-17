FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for PostgreSQL and building Python packages
RUN apt-get update && apt-get install -y libpq-dev gcc build-essential

# Copy requirements or install them explicitly
COPY . /app

# Install required packages
RUN pip install --no-cache-dir \
    pandas \
    psycopg2-binary \
    torch \
    sentence-transformers \
    scikit-learn \
    grpcio \
    grpcio-tools \
    openpyxl

# Expose the gRPC port
EXPOSE 50051

# Command to run the gRPC server
CMD ["python", "grpc_server.py"]
