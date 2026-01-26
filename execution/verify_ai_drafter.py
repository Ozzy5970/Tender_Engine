import os
import json
import urllib.request
import urllib.error
import time

def load_env():
    env = {}
    if os.path.exists(".env"):
        with open(".env", "r") as f:
            for line in f:
                if "=" in line:
                    key, val = line.strip().split("=", 1)
                    env[key] = val
    return env

def verify_ai():
    print("Verifying AI Drafter...")
    env = load_env()
    url = env.get("SUPABASE_URL")
    anon_key = env.get("SUPABASE_ANON_KEY")

    # We need a valid tender_id. Let's fetch one first or use a hardcoded one if we know it exists.
    # From previous runs we might not know it.
    # Let's try to query a tender first.
    print("Fetching a tender context...")
    
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json"
    }
    
    tender_id = None
    try:
        req = urllib.request.Request(f"{url}/rest/v1/tenders?select=id&limit=1", headers=headers)
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read().decode('utf-8'))
            if data and len(data) > 0:
                tender_id = data[0]['id']
                print(f"Using Tender ID: {tender_id}")
            else:
                print("No tenders found. Creating a dummy tender...")
                # We need a user first... this is getting complex for a quick verify.
                # Let's see if we can just pass a dummy UUID if the function doesn't strictly check existence BEFORE AI?
                # The function DOES check: "if (fetchError || !tender) throw new Error('Tender context not found')"
                # So we need a real tender.
                # If no tender exists, we can't test AI easily without setup.
                print("Cannot test AI Drafter without a tender.")
                return 

    except Exception as e:
        print(f"Error fetching tender: {e}")
        return

    if not tender_id:
        return

    print("\n--- Calling 'ai-drafter' ---")
    function_url = f"{url}/functions/v1/ai-drafter"
    payload = {
        "tender_id": tender_id,
        "section_name": "Health and Safety",
        "prompt": "Write a brief safety policy."
    }
    
    try:
        req = urllib.request.Request(
            function_url, 
            data=json.dumps(payload).encode('utf-8'), 
            headers=headers, 
            method='POST'
        )
        # Timeout slightly longer for AI
        with urllib.request.urlopen(req, timeout=30) as res:
            print(f"Status: {res.status}")
            resp_body = res.read().decode('utf-8')
            print(f"Response: {resp_body}")
            
            if "success" in resp_body and "content" in resp_body:
                print("SUCCESS: AI Drafter returned content.")
            else:
                print("WARNING: Response structure unexpected.")

    except urllib.error.HTTPError as e:
        print(f"Function Call Failed: {e.code} {e.reason}")
        print(e.read().decode('utf-8'))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verify_ai()
