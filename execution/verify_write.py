import os
import json
import urllib.request
import urllib.error

def load_env():
    env = {}
    if os.path.exists(".env"):
        with open(".env", "r") as f:
            for line in f:
                if "=" in line:
                    key, val = line.strip().split("=", 1)
                    env[key] = val
    return env

def verify_write():
    print("Verifying DB Write via REST...")
    env = load_env()
    url = env.get("SUPABASE_URL")
    service_key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    
    # Insert a log
    log_entry = {
        "action": "MANUAL_TEST",
        "severity": "INFO",
        "details": {"method": "direct_rest"}
    }
    
    api_url = f"{url}/rest/v1/audit_logs"
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    try:
        req = urllib.request.Request(
            api_url, 
            data=json.dumps(log_entry).encode('utf-8'), 
            headers=headers, 
            method='POST'
        )
        with urllib.request.urlopen(req) as res:
            print(f"Status: {res.status}")
            resp_data = res.read().decode('utf-8')
            print(f"Response: {resp_data}")
            print("SUCCESS: Manually inserted log.")
    except urllib.error.HTTPError as e:
        print(f"Write Failed: {e.code} {e.reason}")
        print(e.read().decode('utf-8'))

if __name__ == "__main__":
    verify_write()
