"""Opt-in live Gemini smoke test. Never prints keys, SDK responses or private images.

Usage: python smoke_size_chart.py path/to/synthetic-size-chart.png
"""
import base64
import os
from pathlib import Path
import sys
from dotenv import load_dotenv
from size_chart import ImageRequest, extract

def main():
    load_dotenv(Path(__file__).parent / '.env')
    if not os.getenv('GEMINI_API_KEY'):
        print('Live Gemini test: NOT RUN (key not configured)')
        return 2
    fixture = Path(sys.argv[1])
    try:
        result = extract(ImageRequest(image_base64=base64.b64encode(fixture.read_bytes()).decode(), mime_type='image/png'))
    except Exception as error:
        code = getattr(error, 'code', None)
        if not isinstance(code, int): code = None
        payload = getattr(error, 'response_json', {})
        invalid_key = False
        if isinstance(payload, dict):
            details = payload.get('error', {}).get('details', [])
            invalid_key = any(isinstance(detail, dict) and detail.get('reason') == 'API_KEY_INVALID' for detail in details)
        print(f'Live Gemini test: FAILED; type={type(error).__name__}; code={code}; invalid_key={invalid_key}')
        return 1
    expected = next((row for row in result.rows if row.size == 'M'), None)
    good = (result.lengthUnit == 'CM' and expected is not None and expected.chest is not None
            and expected.chest.min == 86 and expected.chest.max == 89
            and expected.waist is not None and expected.waist.min == 68 and expected.waist.max == 71)
    print(f'Live Gemini test: {"PASS" if good else "FAILED"}; extracted_rows={len(result.rows)}; exact_fixture_match={good}')
    return 0 if good else 1

if __name__ == '__main__':
    sys.exit(main())
