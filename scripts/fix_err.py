import sys

ingest_path = "c:/Users/austi/OneDrive/Desktop/Antigravity/frontend/src/pages/TenderIngest.tsx"
with open(ingest_path, "r") as f: content = f.read()

content = content.replace("const onError = (errs: any) => {", "const _onError = (errs: any) => {")

with open(ingest_path, "w") as f: f.write(content)
