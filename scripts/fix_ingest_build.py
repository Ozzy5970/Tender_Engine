import sys

ingest_path = "c:/Users/austi/OneDrive/Desktop/Antigravity/frontend/src/pages/TenderIngest.tsx"
with open(ingest_path, "r") as f: content = f.read()

content = content.replace("<form onSubmit={handleSubmit(onSubmit)}", "<form")
content = content.replace("import { useForm, type SubmitHandler } from \"react-hook-form\"", "import { useForm } from \"react-hook-form\"")

with open(ingest_path, "w") as f: f.write(content)
