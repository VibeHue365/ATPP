import json
from urllib.request import Request, urlopen


payload = {
    "entity_type": "PRODUCT",
    "title": "Ao dai truyen thong lua theu hoa",
    "description": "Phu hop chup anh cuoi va le hoi Hue",
    "structured_attributes": {
        "style": "traditional",
        "materials": ["SILK"],
        "occasions": ["wedding"],
    },
    "allowed_tags": [
        {"code": "TRUYEN_THONG", "description": "Phong cach truyen thong"},
        {"code": "CHAT_LIEU_LUA", "description": "Chat lieu lua"},
        {"code": "PHU_HOP_LE_CUOI", "description": "Phu hop le cuoi"},
    ],
    "taxonomy_version": 1,
}
request = Request(
    "http://127.0.0.1:8000/tagging/suggest",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
)

with urlopen(request, timeout=30) as response:
    print(json.dumps(json.loads(response.read().decode("utf-8")), indent=2))
