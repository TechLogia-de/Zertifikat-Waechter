FROM python:3.11-slim

RUN groupadd -g 1001 appuser && \
    useradd -u 1001 -g appuser -s /bin/false appuser

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY --chown=appuser:appuser . .

USER appuser

EXPOSE 5001

CMD ["python", "api.py"]


