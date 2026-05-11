FROM python:3.11-slim

# System deps for markitdown (PDF/DOCX conversion) + pdftotext
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

# Persistent KB storage — mount a volume here in docker-compose
VOLUME ["/data/kb"]

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--log-level", "info"]
