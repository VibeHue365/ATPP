import os
import sys
from google import genai
from google.genai import types
from dotenv import load_dotenv

if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8')

load_dotenv()

api_key = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

models_to_test = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite"
]

print("Testing generate_content on different models...")
for m in models_to_test:
    try:
        response = client.models.generate_content(
            model=m,
            contents="Say 'Hello' in Vietnamese"
        )
        print(f"SUCCESS: Model '{m}' succeeded: {response.text.strip()}")
    except Exception as e:
        print(f"FAIL: Model '{m}' failed: {type(e).__name__} - {e}")
