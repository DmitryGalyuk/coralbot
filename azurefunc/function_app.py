'''
Coralometer backend
'''
import logging
import json
from datetime import datetime
import azure.functions as func
from azure.storage.blob import BlobServiceClient
from azure.keyvault.secrets import SecretClient
from azure.identity import DefaultAzureCredential

from downloadreport import download_file
from reportsprocessing import process_report

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

@app.route(route="coralReportFetch")
def coralReportFetch(req: func.HttpRequest) -> func.HttpResponse:
    ''' Fetches the report from coral.club server '''
    
    logging.info("%s invoked", "coralReportFetch")

    request_body = req.get_json() if req.get_body() else req.params
    login = request_body['login']
    password = request_body['password']
    lang = request_body['lang'] or "by"
    reporttype = request_body['reporttype']
    period = request_body['period']

    # if req.headers["origin"] != "http://127.0.0.1:5500":
    #     return func.HttpResponse("Not found", status_code=404)

    if not login or not password:
        return func.HttpResponse("No login or password provided", status_code=401)

    result = download_file(login, password, lang, reporttype, period)

    return func.HttpResponse(result["result"],
                             status_code=result["status_code"],
                             headers={ "Content-Disposition": result["content_disposition"] })


@app.timer_trigger(schedule="0 0 2 * * *", arg_name="myTimer", run_on_startup=True,
              use_monitor=False)
def dailyReportFetch(myTimer: func.TimerRequest) -> None:
    '''
    Runs daily, fetches the Lena's report and uploads it into blob storage
    '''
    vault_uri = "https://coralkeys.vault.azure.net"
    credential = DefaultAzureCredential()
    client = SecretClient(vault_url=vault_uri, credential=credential)

    coral_creds = client.get_secret("coral-lena-creds")
    coral_creds = json.loads(coral_creds.value)

    period = datetime.today().strftime('%Y%m')
    report = download_file(coral_creds["login"], coral_creds["password"], "us", "CDXPRep", period)

    connection_string = client.get_secret("coral-blob-connectionstring")
    blob_service_client = BlobServiceClient.from_connection_string(connection_string.value)

    container_client = blob_service_client.get_container_client("reportsstore")

    # Upload the file content to the blob
    blob_client = container_client.get_blob_client(datetime.today().strftime('%Y-%m-%d.xlsx'))
    blob_client.upload_blob(report["result"], overwrite=True)

    logging.info('Python timer trigger function executed.')


@app.route(route="processExcel")
def process_dowloaded_reports_func(req: func.HttpRequest) -> func.HttpResponse:
    '''
    Scan for downloaded reports, extract data, load to DB and copy/move processed file to folder with processed files
    '''
    print("process_dowloaded_reports_func")
    try:
        file_name = req.get_json()["file_name"]
        process_report(file_name)
        return func.HttpResponse(status_code=200)
    except:
        return func.HttpResponse(status_code=500)
