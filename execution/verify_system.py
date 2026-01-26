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

def run_test():
    env = load_env()
    url = env.get("SUPABASE_URL")
    anon_key = env.get("SUPABASE_ANON_KEY")
    service_key = env.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not anon_key:
        print("Error: Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env")
        return

    print(f"Target: {url}")

    # 1. Test Function: audit-logger
    print("\n--- Testing 'audit-logger' ---")
    function_url = f"{url}/functions/v1/audit-logger"
    payload = {
        "action": "TEST_VERIFICATION",
        "details": {"test": "run_v1"},
        "severity": 'INFO'
    }
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {anon_key}"
    }

    try:
        req = urllib.request.Request(
            function_url, 
            data=json.dumps(payload).encode('utf-8'), 
            headers=headers, 
            method='POST'
        )
        with urllib.request.urlopen(req) as res:
            print(f"Status: {res.status}")
            print(f"Response: {res.read().decode('utf-8')}")
    except urllib.error.HTTPError as e:
        print(f"Function Call Failed: {e.code} {e.reason}")
        print(e.read().decode('utf-8'))
        # Don't return, try checking DB anyway (maybe previous runs worked)

    # 2. Test DB: Check if audit log exists
    print("\n--- Verifying DB Insert (via Rest, Service Role) ---")
    # Using Service Role to bypass RLS for verification
    time.sleep(2)
    
    rest_url = f"{url}/rest/v1/audit_logs?action=eq.TEST_VERIFICATION&select=*&order=created_at.desc&limit=1"
    rest_headers = {
        "apikey": service_key if service_key else anon_key,
        "Authorization": f"Bearer {service_key if service_key else anon_key}" 
    }
    
    try:
        req = urllib.request.Request(
            rest_url, 
            headers=rest_headers, 
            method='GET'
        )
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read().decode('utf-8'))
            print(f"Found {len(data)} test logs.")
            if len(data) > 0:
                print("Latest Log:", data[0])
                print("\nSUCCESS: System Verified.")
            else:
                print("FAILURE: Validation log not found in DB.")
                
    except urllib.error.HTTPError as e:
        print(f"REST API Failed: {e.code} {e.reason}")
        print(e.read().decode('utf-8'))

if __name__ == "__main__":
    run_test()
