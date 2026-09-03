# Build the front end, then serve it from the Python API.
# Two stages so the runtime image carries no Node toolchain.

FROM node:20-slim AS web
WORKDIR /build
COPY web/package*.json ./web/
RUN cd web && npm ci
COPY web ./web
RUN cd web && npm run build

FROM python:3.12-slim
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ml ./ml
COPY backend ./backend
COPY scripts ./scripts
COPY --from=web /build/web/dist ./web/dist

ENV PORT=8000
EXPOSE 8000

# One worker: the model bundle is loaded per process and the SHAP explainer is
# warmed at import, so extra workers multiply memory without helping much.
CMD ["sh", "-c", "gunicorn --chdir backend app:app --bind 0.0.0.0:${PORT} --timeout 120 --workers 1"]
