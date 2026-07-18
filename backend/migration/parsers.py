import re
from decimal import Decimal, InvalidOperation


def _num(s):
    """First numeric token in s → Decimal; comma decimals allowed. None if none."""
    if s is None:
        return None
    m = re.search(r"-?\d+(?:[.,]\d+)?", str(s))
    if not m:
        return None
    try:
        return Decimal(m.group(0).replace(",", "."))
    except InvalidOperation:
        return None


_NONALC = re.compile(r"non\s*alc", re.IGNORECASE)


def parse_abv(raw):
    """(abv, is_alcoholic). 'Non Alc'/blank → (None, False)."""
    if raw is None or str(raw).strip() == "":
        return (None, False)
    if _NONALC.search(str(raw)):
        return (None, False)
    val = _num(raw)
    if val is None or val == 0:
        return (None, False)
    return (val, True)


def is_nonalc_marker(raw):
    """True iff `raw` explicitly denotes non-alcoholic (matches the 'Non Alc'
    marker) — distinct from blank/absent, which just means the ABV wasn't
    filled in (unknown, not necessarily non-alcoholic). Used by callers that
    want a "default to alcoholic unless proven otherwise" policy (e.g.
    author cocktails), where `parse_abv`'s blanket `(None, False)` for blank
    input would be wrong."""
    return raw is not None and str(raw).strip() != "" and bool(_NONALC.search(str(raw)))


_SERVING = re.compile(r"за\s*(\d+)(?:\s*мл)?", re.IGNORECASE | re.DOTALL)


def parse_price(raw):
    """(amount, serving_ml). Amount = leading numeric (strip 'р'/'₽'); serving from 'за N[мл]'."""
    if raw is None or str(raw).strip() == "":
        return (None, None)
    text = str(raw)
    amount = _num(text)
    serving = None
    m = _SERVING.search(text)
    if m:
        serving = int(m.group(1))
    return (amount, serving)


def parse_weight_g(raw):
    n = _num(raw)
    return int(n) if n is not None else None


def parse_timing(raw):
    """(min_low, min_high). '10-12'→(10,12); '10'→(10,10)."""
    if raw is None or str(raw).strip() == "":
        return (None, None)
    nums = re.findall(r"\d+", str(raw))
    if not nums:
        return (None, None)
    if len(nums) == 1:
        v = int(nums[0])
        return (v, v)
    return (int(nums[0]), int(nums[1]))


_EMPTY_NUTR = {"kcal_portion": None, "protein_g": None, "fat_g": None,
               "carb_g": None, "kcal_100g": None}

# Format A: "На порцию: 329г · 503 ккал · Б 29,0 · Ж 6,8 · У 75,7"
_A_PORTION = re.compile(
    r"порци[юя].*?(\d[\d.,]*)\s*ккал.*?б\s*([\d.,]+).*?ж\s*([\d.,]+).*?у\s*([\d.,]+)",
    re.IGNORECASE | re.DOTALL)
# Format B: "На порцию б 0,16 ж 18,62 у 5,96 195,2 ккал"
_B_PORTION = re.compile(
    r"порци[юя]\s*б\s*([\d.,]+)\s*ж\s*([\d.,]+)\s*у\s*([\d.,]+)\s*([\d.,]+)\s*ккал",
    re.IGNORECASE | re.DOTALL)
_PER100 = re.compile(r"на\s*100\s*гр?.*?(\d[\d.,]*)\s*ккал", re.IGNORECASE | re.DOTALL)


def parse_nutrition(raw):
    if raw is None or str(raw).strip() == "":
        return dict(_EMPTY_NUTR)
    text = str(raw)
    out = dict(_EMPTY_NUTR)
    mb = _B_PORTION.search(text)
    if mb:
        out["protein_g"] = _num(mb.group(1))
        out["fat_g"] = _num(mb.group(2))
        out["carb_g"] = _num(mb.group(3))
        out["kcal_portion"] = _num(mb.group(4))
    else:
        ma = _A_PORTION.search(text)
        if ma:
            out["kcal_portion"] = _num(ma.group(1))
            out["protein_g"] = _num(ma.group(2))
            out["fat_g"] = _num(ma.group(3))
            out["carb_g"] = _num(ma.group(4))
    m100 = _PER100.search(text)
    if m100:
        out["kcal_100g"] = _num(m100.group(1))
    return out


_URL = re.compile(r"https?://\S+")
_REGION = re.compile(r"^\s*регион:\s*", re.IGNORECASE)


def parse_spirit_origin(brand, country, brand_country):
    brand = (brand or "").strip() or None
    country = (country or "").strip()
    country = _REGION.sub("", country).strip() or None
    bc = brand_country or ""
    url_m = _URL.search(bc)
    source_url = url_m.group(0) if url_m else None
    description = _URL.sub("", bc).strip() or None
    return {"brand": brand, "country": country,
            "description": description, "source_url": source_url}
