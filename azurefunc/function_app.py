'''
Coralometer backend
'''
import logging
import re
import json
from datetime import datetime
import requests
import azure.functions as func
from azure.storage.blob import BlobServiceClient
from azure.keyvault.secrets import SecretClient
from azure.identity import DefaultAzureCredential

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

'''
Fetches the report from coral.club server
'''
@app.route(route="coralReportFetch")
def coralReportFetch(req: func.HttpRequest) -> func.HttpResponse:
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


'''
Runs daily, fetches the Lena's report and uploads it into blob storage
'''
@app.timer_trigger(schedule="0 0 2 * * *", arg_name="myTimer", run_on_startup=True,
              use_monitor=False)
def dailyReportFetch(myTimer: func.TimerRequest) -> None:
    vault_uri = "https://coralkeys.vault.azure.net"
    credential = DefaultAzureCredential()
    client = SecretClient(vault_url=vault_uri, credential=credential)

    coral_creds = client.get_secret("coral-lena-creds")
    coral_creds = json.loads(coral_creds.value)

    period = datetime.today().strftime('%Y%m')
    report = download_file(coral_creds["login"], coral_creds["password"], "en", "CDXPRep", period)

    connection_string = client.get_secret("coral-blob-connectionstring")
    blob_service_client = BlobServiceClient.from_connection_string(connection_string.value)

    container_client = blob_service_client.get_container_client("reportsstore")

    # Upload the file content to the blob
    blob_client = container_client.get_blob_client(datetime.today().strftime('%Y-%m-%d.xlsx'))
    blob_client.upload_blob(report["result"], overwrite=True)

    logging.info('Python timer trigger function executed.')


'''
Download report as blob from coral site
returns object {status_code, content_disposition, result}
'''
def download_file (login, password, lang, reporttype, period):
    logging.info('calling coral.club root')
    r = requests.get(f"https://{lang}.coral.club", timeout=10)
    logging.info("%s: %s", r.status_code, r.text)

    cookies = r.cookies
    cookies["CC_2019_LOGIN"] = login
    headers = {
        "authoritfy": "{lang}.coral.club",
        "Accept-Encoding": "gzip, deflate, br",
        "accept": "*/*",
        "accept-language": "en-GB,en-US;q=0.9,en;q=0.8,ru;q=0.7",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "origin": f"https://{lang}.coral.club",
        "referer": f"https://{lang}.coral.club/",
        "sec-ch-ua": "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Google Chrome\";v=\"120\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"macOS\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
#        "x-requested-with": "XMLHttpRequest",

    }

    logging.info("calling auth.php")
    r = requests.post(f'https://{lang}.coral.club/ajax/auth.php?access=yes&login={login}&password={password}'
                      , cookies=cookies, timeout=10, headers=headers
                      , data=f"BACK_URL=%2F&access=yes&login={login}&password={password}&userAuth=false")
    logging.info("%s: %s", r.status_code, r.text)
    if r.status_code != 200:
        return {"result": r.text, "status_code": r.status_code}


    logging.info("calling reports_xls2.php")
    r = requests.get(f"https://{lang}.coral.club/personal-new/structure/reports/reports_xls2.php?p1={reporttype}&p2={period}"
                     , cookies=cookies, timeout=10, headers=headers)
    logging.info("%s: %s", r.status_code, r.text)
    if r.status_code != 200:
        return {"result":r.text, "status_code":r.status_code}

    content = r.content
    result = re.sub(b".*</script>", b"", content, 0, re.DOTALL)

    print(r.headers["content-disposition"])
    return {
        "result": result, 
        "status_code": r.status_code, 
        "content_disposition": r.headers["Content-Disposition"]
    }
