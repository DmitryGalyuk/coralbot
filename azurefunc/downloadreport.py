import logging
import requests
import re

def download_file (login, password, lang, reporttype, period):
    '''
    Download report as blob from coral site
    returns object {status_code, content_disposition, result}
    '''
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
