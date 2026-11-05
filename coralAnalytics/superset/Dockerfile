FROM apache/superset:4.1.1

USER root
COPY superset /app/superset
COPY import_superset_exports.py /app/import_superset_exports.py
RUN chmod -R a+rX /app/superset /app/import_superset_exports.py \
	&& chown -R superset:superset /app/superset /app/import_superset_exports.py \
	&& pip install --no-cache-dir psycopg2-binary
USER superset