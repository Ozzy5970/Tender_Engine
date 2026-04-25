import sys
import re

ingest_path = "c:/Users/austi/OneDrive/Desktop/Antigravity/frontend/src/pages/TenderIngest.tsx"
with open(ingest_path, "r") as f: content = f.read()

# Remove the _onError function entirely
content = re.sub(r'const _onError = \(errs: any\) => \{[\s\S]*?\}\s*(?=<div)', "", content)

with open(ingest_path, "w") as f: f.write(content)
