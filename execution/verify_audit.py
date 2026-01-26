import os
import json
import urllib.request
import urllib.error
import sys

# Force unbuffered
# sys.stdout.reconfigure(encoding='utf-8') # Might fail on some python versions/envs if not standard? 
# Python 3.13 should support it. But safe to just print flush.

env = {}
if os.path.exists(".env"):
    with open(".env", "r") as f:
        for line in f:
            if "=" in line:
                k, v = line.strip().split("=", 1)
                env[k] = v

url = env.get("SUPABASE_URL")
key = env.get("SUPABASE_ANON_KEY")

print(f"Calling {url}/functions/v1/audit-logger", flush=True)
req = urllib.request.Request(
    f"{url}/functions/v1/audit-logger",
    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    data=json.dumps({"action": "DEBUG_TEST", "severity": "INFO"}).encode('utf-8'),
    method="POST"
)

try:
    with urllib.request.urlopen(req) as res:
        print(f"Status: {res.status}", flush=True)
        print(f"Body: {res.read().decode('utf-8')}", flush=True)
except urllib.error.HTTPError as e:
    print(f"Error {e.code}", flush=True)
    print(e.read().decode('utf-8'), flush=True)
