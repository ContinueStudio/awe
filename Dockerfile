# ---- Stage 1: Build frontend ----
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npx vite build

# ---- Stage 2: Runtime ----
FROM python:3.12-slim
WORKDIR /app

# Install system deps for Chrome (DrissionPage)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ ./backend/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist/

EXPOSE 8765
CMD ["python", "-m", "uvicorn", "app.main:app", \
     "--app-dir", "backend", "--host", "0.0.0.0", "--port", "8765"]
