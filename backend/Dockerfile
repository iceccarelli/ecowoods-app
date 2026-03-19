###############################################################################
# EcoWoods API - Dockerfile
# Supports Python 3.11, 3.12, 3.13
###############################################################################

# ---------- Stage 1: Builder ----------
FROM python:3.12-slim AS builder

WORKDIR /build

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ---------- Stage 2: Runtime ----------
FROM python:3.12-slim AS runtime

# Security: run as non-root user
RUN groupadd -r ecowoods && useradd -r -g ecowoods -d /app -s /sbin/nologin ecowoods

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy backend application code
COPY app/ /app/app/
COPY alembic.ini /app/alembic.ini
COPY migrations/ /app/migrations/
COPY requirements.txt /app/requirements.txt

# The admin-dashboard is mounted as a volume via docker-compose
# Create the directory so the mount point exists
RUN mkdir -p /app/admin-dashboard && chown -R ecowoods:ecowoods /app

USER ecowoods

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Start the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
