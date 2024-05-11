import os
import logging
import json
import struct
from typing import List
from azure.storage.blob import BlobServiceClient, ContainerClient
from azure.keyvault.secrets import SecretClient
from azure.identity import DefaultAzureCredential
import pyodbc

from report2table import report_to_table

SOURCE_CONTAINER = "reportsstore"
PROCESSED_CONTAINER = "processedreports"

os.environ['AZURE_CLIENT_ID'] = 'f1f492d1-ad11-4504-a071-9246d50970aa'
os.environ['AZURE_TENANT_ID'] = '4e9d6226-3d74-4d84-b473-bed66f1d0be9'
os.environ['AZURE_CLIENT_SECRET'] = '-Yg8Q~ZxG.h5L.qTeB0bWVXilHWp3jFcLctYdc1x'

def process_reports():
    for source_file in list_files(SOURCE_CONTAINER):
        if source_file not in list_files(PROCESSED_CONTAINER):
            print(f"Processing {source_file}")
            report_contents = read_blob(SOURCE_CONTAINER,source_file)
            df = report_to_table(report_contents)
            

            with sqlserver_connection() as con:


            exit()


def sqlserver_connection():
    conn_string = 'DRIVER={ODBC Driver 18 for SQL Server};' \
             + 'SERVER=coralsql.database.windows.net;' \
              + 'DATABASE=coral;'
    credential = DefaultAzureCredential()
    token_bytes = credential.get_token("https://database.windows.net/.default").token.encode("UTF-16-LE")
    token_struct = struct.pack(f'<I{len(token_bytes)}s', len(token_bytes), token_bytes)
    SQL_COPT_SS_ACCESS_TOKEN = 1256  # This connection option is defined by microsoft in msodbcsql.h
    con = pyodbc.connect(conn_string, attrs_before={SQL_COPT_SS_ACCESS_TOKEN: token_struct})
    return con


_container_client = {}
def container_client(container: str) -> ContainerClient:
    if container in _container_client:
        return _container_client[container]
    
    vault_uri = "https://coralkeys.vault.azure.net"
    credential = DefaultAzureCredential()
    client = SecretClient(vault_url=vault_uri, credential=credential)

    coral_creds = client.get_secret("coral-lena-creds")
    coral_creds = json.loads(coral_creds.value)

    connection_string = client.get_secret("coral-blob-connectionstring")
    blob_service_client = BlobServiceClient.from_connection_string(connection_string.value)

    _container_client[container] = blob_service_client.get_container_client(container)
    return _container_client[container]

def list_files(container_name: str) -> List[str]:
    container = container_client(container_name)
    return container.list_blob_names()

def read_blob(container, file_name):
    return container_client(container).get_blob_client(file_name).download_blob().readall()

sqlserver_connection()
process_reports()