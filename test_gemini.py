import google.generativeai as genai
import os

# Test the Gemini API
GEMINI_API_KEY = "AIzaSyAo_aCoivRNbKLEzB3PYOAii9_FbFDArcU"
genai.configure(api_key=GEMINI_API_KEY)

print("Testing Gemini API...")
try:
    model = genai.GenerativeModel('gemini-1.5-pro')
    response = model.generate_content("Say 'Hello, I am working!' in one sentence.")
    print(f"✅ Success! Response: {response.text}")
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
