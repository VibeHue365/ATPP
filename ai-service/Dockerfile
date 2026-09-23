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

COPY . ./

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
