import sys

ingest_path = "c:/Users/austi/OneDrive/Desktop/Antigravity/frontend/src/pages/TenderIngest.tsx"
with open(ingest_path, "r") as f: content = f.read()

content = content.replace("<form onSubmit={handleSubmit(onSubmit, onError)} className=\"space-y-8\">", "<form className=\"space-y-8\">")

with open(ingest_path, "w") as f: f.write(content)
