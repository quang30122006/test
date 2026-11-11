import json
import socket
import threading
import time
import urllib.request
import webbrowser
import uvicorn


def is_port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.4)
        return s.connect_ex(("127.0.0.1", port)) == 0


def is_agribank_running(port: int) -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=1.2) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("service") == "AGRIBANK 3P"
    except Exception:
        return False


def main():
    port = 8000
    if is_port_in_use(port):
        if is_agribank_running(port):
            url = f"http://127.0.0.1:{port}"
            print(f"[INFO] Ung dung AGRIBANK 3P da dang chay san tai {url}")
            webbrowser.open(url)
            input("Nhan Enter de dong cua so nay...")
            return
        # Tim cong trong tiep theo neu cong 8000 bi phan mem khac chiem dung
        for candidate in range(8001, 8020):
            if not is_port_in_use(candidate):
                port = candidate
                break

    url = f"http://127.0.0.1:{port}"
    print("=" * 60)
    print("  AGRIBANK 3P - HE THONG TIEN LUONG & KPI (WEB EDITION)")
    print(f"  Dang khoi dong may chu tai {url} ...")
    print("=" * 60)

    def _open_when_ready():
        for _ in range(30):
            if is_port_in_use(port):
                webbrowser.open(url)
                return
            time.sleep(0.3)

    threading.Thread(target=_open_when_ready, daemon=True).start()
    uvicorn.run("app.main:app", host="127.0.0.1", port=port, log_level="info")


if __name__ == "__main__":
    main()

