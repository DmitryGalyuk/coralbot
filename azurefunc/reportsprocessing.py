''' Coral report Azure hanldling '''

import json
from typing import List
from azure.storage.blob import BlobServiceClient, ContainerClient
from azure.keyvault.secrets import SecretClient
from azure.identity import DefaultAzureCredential
from pandas import DataFrame

from report2table import report_to_table

SOURCE_CONTAINER = "reportsstore"
PROCESSED_CONTAINER = "processedreports"

def process_report(file_name: str):
    ''' Reads excel file, cleans and upload as parquet to Azure Blob Storage '''
    report_contents = read_blob(SOURCE_CONTAINER, file_name)
    df: DataFrame = report_to_table(report_contents)
    save_blob(PROCESSED_CONTAINER, file_name+".parquet", df.to_parquet())


_container_client = {}
def container_client(container: str) -> ContainerClient:
    ''' Creates the client to specific Azure Blob Storage Container '''
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
    ''' Lists files in Azure Blob Starage container '''
    container = container_client(container_name)
    return container.list_blob_names()

def read_blob(container, file_name):
    ''' Reads the blob from Azure Blob Storage container '''
    return container_client(container).get_blob_client(file_name).download_blob().readall()

def save_blob(container_name, file_name, data: bytes):
    ''' Uploads the blob to Azure Blob Storage container '''
    container = container_client(container_name)
    container.upload_blob(file_name, data, blob_type="BlockBlob")
