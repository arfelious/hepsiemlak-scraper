import os
import sys
import json
import random
import requests
import tempfile
BASE_URL = "https://www.hepsiemlak.com"
COOKIE_PATH = os.path.join(tempfile.gettempdir(), "cookie_hepsiemlak.txt")
USER_AGENTS = [
    ("Mozilla/5.0 (X11; Linux x86_64; rv:136.0) Gecko/20100101 Firefox/136.0", 0.2),
    ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36", 0.3),
    ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36", 0.4),
    ("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36", 0.1),
]
CAPTCHA_ERR = "Hata. Robot doğrulamasını geçmek gerekebilir.\nYönerge: https://github.com/arfelious/hepsiemlak-scraper/blob/main/captcha.md"
IMG_EXT = ["jpg", "jpeg", "png", "gif", "webp"]

def load_cookie():
    return open(COOKIE_PATH).read().strip() if os.path.exists(COOKIE_PATH) else ""

cookie = load_cookie()

def get_weighted_random(user_agents):
    total_weight = sum(weight for _, weight in user_agents)
    rand = random.uniform(0, total_weight)
    for agent, weight in user_agents:
        rand -= weight
        if rand <= 0:
            return agent

def get_headers():
    return {
            "cookie": cookie,
            "User-Agent": get_weighted_random(USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Sec-GPC": "1",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "cross-site",
            "Priority": "u=0, i",
            "Pragma": "no-cache",
            "cache-control": "max-age=0",
            "upgrade-insecure-requests": "1",
            "sec-ch-ua": "\"Chromium\";v=\"133\", \"Not(A:Brand\";v=\"99\"",
        }

def get_listing_ids():
    url = f"{BASE_URL}/api/realty-map/?mapSize=2500&intent=satilik&city=sakarya&mainCategory=konut&mapCornersEnabled=true"
    res = requests.get(url, headers=get_headers())
    try:
        content = res.text
        if "Just a moment..." in content:
            raise Exception(CAPTCHA_ERR)
        data = json.loads(content)
        return [x["listingId"] for x in data["realties"]]
    except Exception as e:
        print("Hata. İlan ID'leri alınamadı.", str(e), file=sys.stderr)
        return []

def remove_images(obj):
    if isinstance(obj, dict):
        return {k: remove_images(v) for k, v in obj.items() if not (isinstance(v, str) and any(ext in v for ext in IMG_EXT))}
    elif isinstance(obj, list):
        return [remove_images(item) for item in obj]
    return obj

def get_listing(listing_id):
    url = f"{BASE_URL}/api/realties/{listing_id}"
    res = requests.get(url, headers=get_headers())
    try:
        content = res.text
        if "Just a moment..." in content:
            raise Exception(CAPTCHA_ERR)
        data = json.loads(content)
        listing = data.get("realtyDetail", {})
        listing = remove_images(listing)
        listing.pop("breadcrumbs", None)
        return json.dumps(listing)
    except Exception as e:
        print("Hata. İlan bilgileri alınamadı.", str(e), file=sys.stderr)
        return None

def main():
    global cookie
    while True:
        choice = input("İşlem: (al/listele/cookie): ").strip().lower()
        if choice == "al":
            listing_id = input("İlan ID: ").strip()
            listing_data = get_listing(listing_id)
            if listing_data:
                print(listing_data)
        elif choice == "listele":
            ids = get_listing_ids()
            if ids:
                max_per_line = max(1, os.get_terminal_size().columns // 16)
                for i, listing_id in enumerate(ids, 1):
                    print(f"{listing_id:>15}", end=" " if i % max_per_line else "\n")
                print("\nListelenen ilanların başkaları tarafından alınmadığını kontrol etmeyi unutmayın.")
        elif choice == "cookie":
            new_cookie = input("Cookie: ").strip()
            with open(COOKIE_PATH, "w") as f:
                f.write(new_cookie)
            cookie = new_cookie
        else:
            print("Geçersiz işlem.")

if __name__ == "__main__":
    main()
