import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.environ.get("GEMINI_API_KEY")
print(f"API Key loaded: {api_key is not None}")
client = genai.Client(api_key=api_key)

print("Listing models:")
try:
    for m in client.models.list():
        print(f"Name: {m.name}")
except Exception as e:
    print(f"Error listing: {e}")
