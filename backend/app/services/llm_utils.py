import json


def parse_json(raw: str) -> dict:
    raw = raw.strip()
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("Model nije vratio JSON")
    return json.loads(raw[start : end + 1])