# Hugging Face Space image.
#
# Same two stages as the root Dockerfile — Node builds the front end, the
# runtime carries only Python — with the port and user Spaces expects.

FROM node:20-slim AS web
WORKDIR /build
COPY web/package*.json ./web/
RUN cd web && npm ci
COPY web ./web
RUN cd web && npm run build

FROM python:3.12-slim

# Spaces run as uid 1000; give that user a home it can write to.
RUN useradd -m -u 1000 user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PORT=7860 \
    MALLOC_ARENA_MAX=2 \
    MPLCONFIGDIR=/tmp/mpl \
    HF_HOME=/tmp/hf

WORKDIR $HOME/app

COPY --chown=user requirements-runtime.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements-runtime.txt

COPY --chown=user ml ./ml
COPY --chown=user backend ./backend
COPY --chown=user scripts ./scripts
COPY --chown=user data/bundled ./data/bundled
COPY --chown=user --from=web /build/web/dist ./web/dist

USER user
EXPOSE 7860

# One worker: each process loads its own model bundles, and the SHAP explainer
# is warmed at import, so extra workers multiply memory without helping much.
CMD ["sh", "-c", "gunicorn --chdir backend app:app --bind 0.0.0.0:${PORT} --timeout 180 --workers 1"]
