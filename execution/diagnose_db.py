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

def diagnose():
    print("Diagnosing DB Schema...")
    env = load_env()
    url = env.get("SUPABASE_URL")
    service_key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_ANON_KEY")
    
    # List last 5 logs
    print("Listing last 5 audit logs...")
    api_url = f"{url}/rest/v1/audit_logs?select=*&order=created_at.desc&limit=5"
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}"
    }
    
    try:
        req = urllib.request.Request(api_url, headers=headers)
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read().decode('utf-8'))
            print(f"Found {len(data)} logs.")
            for log in data:
                print(f"- {log.get('created_at')} [{log.get('action')}]: {log.get('details')}")
    except urllib.error.HTTPError as e:
        print(f"Error {e.code}: {e.reason}")
        print(e.read().decode('utf-8'))

if __name__ == "__main__":
    diagnose()
