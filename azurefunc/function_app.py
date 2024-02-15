'''
Coralometer backend
'''
import logging
import azure.functions as func
import requests
import re

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

@app.route(route="coralReportFetch")
def coralReportFetch(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a request.')

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

    r = requests.get(f"https://{lang}.coral.club", timeout=10)
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
    r = requests.post(f'https://{lang}.coral.club/ajax/auth.php?access=yes&login={login}&password={password}'
                      , cookies=cookies, timeout=10, headers=headers
                      , data=f"BACK_URL=%2F&access=yes&login={login}&password={password}&userAuth=false")
    
    r = requests.get(f"https://{lang}.coral.club/personal-new/structure/reports/reports_xls2.php?p1={reporttype}&p2={period}"
                     , cookies=cookies, timeout=10, headers=headers)
    
    content = r.content
    result = re.sub(b".*</script>", b"", content, 0, re.DOTALL)

    print(r.headers["content-disposition"])
    return func.HttpResponse(result, status_code=r.status_code, headers={"Content-Disposition": r.headers["Content-Disposition"]})
