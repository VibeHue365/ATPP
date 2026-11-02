FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir torch==2.5.1 --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

ARG SMART_TAG_EMBEDDING_MODEL=intfloat/multilingual-e5-small
ENV SMART_TAG_EMBEDDING_MODEL=${SMART_TAG_EMBEDDING_MODEL}
ENV HF_HOME=/app/model-cache
RUN python -c "from sentence_transformers import SentenceTransformer; import os; SentenceTransformer(os.environ['SMART_TAG_EMBEDDING_MODEL'])"
ENV SMART_TAG_LOCAL_FILES_ONLY=true

# Visual search (VIB-93): bake CLIP into the image so containers start offline.
ARG VISUAL_SEARCH_MODEL=clip-ViT-B-32
ENV VISUAL_SEARCH_MODEL=${VISUAL_SEARCH_MODEL}
RUN python -c "from sentence_transformers import SentenceTransformer; import os; SentenceTransformer(os.environ['VISUAL_SEARCH_MODEL'])"
ENV VISUAL_SEARCH_LOCAL_FILES_ONLY=true
# The catalog and its photos come from the backend/frontend running on the host;
# override in ai-service/.env when they live elsewhere.
ENV BACKEND_URL=http://host.docker.internal:3000 \
    FRONTEND_URL=http://host.docker.internal:5173

COPY . ./

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
