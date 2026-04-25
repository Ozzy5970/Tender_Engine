import sys

tenders_path = "c:/Users/austi/OneDrive/Desktop/Antigravity/frontend/src/pages/Tenders.tsx"
with open(tenders_path, "r") as f: content = f.read()

content = content.replace(".createSignedUrl(tender.source_pdf_path, 3600);", ".createSignedUrl(tender.source_pdf_path as string, 3600);")

with open(tenders_path, "w") as f: f.write(content)
