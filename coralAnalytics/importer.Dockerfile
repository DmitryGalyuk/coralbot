FROM coral-analytics-superset:4.1.1

USER root
COPY requirements.txt /app/requirements-local.txt
RUN pip install --no-cache-dir -r /app/requirements-local.txt

COPY src /app/src
ENV PYTHONPATH=/app/src PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
USER superset

CMD ["python", "-m", "coral_analytics.run"]