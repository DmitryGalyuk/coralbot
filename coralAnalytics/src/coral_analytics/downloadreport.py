import logging
import re
import time

import requests


def download_file(login, password, lang, reporttype, period):
    """Download a Coral Club Excel report using the existing site workflow."""
    max_attempts = 5
    for attempt in range(1, max_attempts + 1):
        try:
            return _download_once(login, password, lang, reporttype, period)
        except requests.RequestException as error:
            response = getattr(error, "response", None)
            status_code = response.status_code if response is not None else None
            retryable_status = status_code in (408, 429) or (
                status_code is not None and 500 <= status_code < 600
            )
            retryable_network_error = isinstance(
                error, (requests.Timeout, requests.ConnectionError)
            )
            if attempt == max_attempts or not (retryable_status or retryable_network_error):
                raise

            delay = min(2**attempt, 8)
            logging.warning(
                "Coral report request attempt %d/%d failed (%s); retrying in %d seconds",
                attempt,
                max_attempts,
                type(error).__name__,
                delay,
            )
            time.sleep(delay)


def _download_once(login, password, lang, reporttype, period):
    origin = f"https://{lang}.coral.club"
    headers = {
        "Accept": "*/*",
        "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8,ru;q=0.7",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Origin": origin,
        "Referer": f"{origin}/",
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
    }

    with requests.Session() as session:
        response = session.get(origin, timeout=30)
        response.raise_for_status()
        session.cookies["CC_2019_LOGIN"] = login

        auth = session.post(
            f"{origin}/ajax/auth.php",
            params={"access": "yes", "login": login, "password": password},
            data={
                "BACK_URL": "/",
                "access": "yes",
                "login": login,
                "password": password,
                "userAuth": "false",
            },
            headers=headers,
            timeout=30,
        )
        auth.raise_for_status()

        report = session.get(
            f"{origin}/personal-new/structure/reports/reports_xls2.php",
            params={"p1": reporttype, "p2": period},
            headers=headers,
            timeout=60,
        )
        report.raise_for_status()

    content = re.sub(b".*</script>", b"", report.content, count=1, flags=re.DOTALL)
    content_disposition = report.headers.get("Content-Disposition")
    if not content_disposition:
        logging.error("Report response did not include a Content-Disposition header")
        raise RuntimeError("Coral Club did not return an Excel report")

    return content