import unicodedata
import re


def clean_ascii(text: str) -> str:
    """Chuẩn hóa chuỗi tiếng Việt sang chữ hoa không dấu ASCII (tương đương CleanAscii trong VBA)."""
    if not text:
        return ""
    s = str(text).strip()
    s = s.replace("Đ", "D").replace("đ", "d")
    nfkd = unicodedata.normalize("NFKD", s)
    ascii_str = "".join(ch for ch in nfkd if not unicodedata.combining(ch))
    return ascii_str.upper()


def parse_month_number(val) -> int:
    """Trích xuất số tháng 1..12 từ chuỗi như 'Tháng 10/2026', '2026-10', '10', 'T10'."""
    if val is None:
        return 0
    s = clean_ascii(str(val))
    if not s:
        return 0
    if s.isdigit():
        n = int(s)
        return n if 1 <= n <= 12 else 0
    m = re.match(r"^\d{4}-(\d{1,2})$", s)
    if m:
        n = int(m.group(1))
        return n if 1 <= n <= 12 else 0
    m = re.search(r"(\d{1,2})\s*/\s*\d{4}", s)
    if m:
        n = int(m.group(1))
        return n if 1 <= n <= 12 else 0
    m = re.search(r"(?:THANG|T)\s*(\d{1,2})", s)
    if m:
        n = int(m.group(1))
        return n if 1 <= n <= 12 else 0
    return 0


_DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"]
_UNITS = ["", " nghìn", " triệu", " tỷ", " nghìn tỷ"]


def _read_three_digits(num: int, read_zero_hundred: bool) -> str:
    hundred = num // 100
    ten = (num % 100) // 10
    unit = num % 10
    parts = []

    if hundred > 0 or read_zero_hundred:
        parts.append(f"{_DIGITS[hundred]} trăm")

    if ten == 0:
        if unit > 0 and (hundred > 0 or read_zero_hundred):
            parts.append(f"linh {_DIGITS[unit]}")
        elif unit > 0:
            parts.append(_DIGITS[unit])
    elif ten == 1:
        parts.append("mười")
        if unit == 5:
            parts.append("lăm")
        elif unit > 0:
            parts.append(_DIGITS[unit])
    else:
        parts.append(f"{_DIGITS[ten]} mươi")
        if unit == 1:
            parts.append("mốt")
        elif unit == 5:
            parts.append("lăm")
        elif unit > 0:
            parts.append(_DIGITS[unit])

    return " ".join(parts).strip()


def doc_so_thanh_chu(amount: float) -> str:
    """Đọc số tiền VNĐ bằng tiếng Việt có dấu chuẩn ngân hàng."""
    if amount is None:
        return "Không đồng"
    val = int(round(abs(float(amount))))
    if val == 0:
        return "Không đồng"

    prefix = "Âm " if float(amount) < 0 else ""
    groups = []
    while val > 0:
        groups.append(val % 1000)
        val //= 1000
    groups.reverse()

    parts = []
    total_groups = len(groups)
    for i, g in enumerate(groups):
        if g > 0:
            read_zero_hundred = i > 0
            text = _read_three_digits(g, read_zero_hundred)
            unit = _UNITS[total_groups - 1 - i] if (total_groups - 1 - i) < len(_UNITS) else ""
            parts.append(f"{text}{unit}")

    res = " ".join(parts).strip()
    if res:
        res = prefix + res[0].upper() + res[1:] + " đồng chẵn."
    return res

