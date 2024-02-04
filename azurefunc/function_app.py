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

    login = req.params.get('login')
    password = req.params.get('password')
    if not login or not password:
        return func.HttpResponse("No login or password provided", status_code=401)

    r = requests.get("https://coral.club", timeout=10)
    cookies = r.cookies
    cookies["CC_2019_LOGIN"] = login
    headers = {
        "authority": "pl.coral.club",
        "accept": "*/*",
        "accept-language": "en-GB,en-US;q=0.9,en;q=0.8,ru;q=0.7",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "cookie": "_ym_uid=1689428518914397330; CC_2019_LOGIN=6190205; _ga=GA1.1.272620803.1689428517; _fbp=fb.1.1707045548388.1806160219; _ym_d=1707045548; BITRIX_CONVERSION_CONTEXT_s1=%7B%22ID%22%3A4%2C%22EXPIRE%22%3A1707087540%2C%22UNIQUE%22%3A%5B%22conversion_visit_day%22%5D%7D; _ym_isad=2; CC_2019_SOUND_LOGIN_PLAYED=Y; CC_2019_COOKIE_VAL=YES; CC_2019_cnew_location=PL; CC_2019_cnew_language=pl; _ym_visorc=b; BX_USER_ID=dc6113c09934c860f775d3d48a08845c; cci_detected_timezone=Europe%2FWarsaw; PHPSESSID=9j5590paf45bq4lj5bd9se0i1e; CC_2019_SALE_UID=71b8406a8aca76852fd8e015209d847a; _ga_MLKGZ6XHY5=GS1.1.1707059022.7.1.1707060866.50.0.0",
        "origin": "https://pl.coral.club",
        "referer": "https://pl.coral.club/login/",
        "sec-ch-ua": "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Google Chrome\";v=\"120\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"macOS\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "x-requested-with": "XMLHttpRequest",

    }
    r = requests.post(f'https://coral.club/ajax/auth.php?access=yes&login={login}&password={password}'
                      , cookies=cookies, timeout=10, headers=headers)
    
    r = requests.get("https://coral.club/personal-new/structure/reports/reports_xls2.php?p1=PPRep&p2=202401"
                     , cookies=cookies, timeout=10, headers=headers)
    
    content = r.content
    result = re.sub(b".*</script>", b"", content, 0, re.DOTALL)

    return func.HttpResponse(result, status_code=r.status_code, headers={"content-disposition": r.headers["content-disposition"]})
