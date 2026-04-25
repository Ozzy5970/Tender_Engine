import sys

ingest_path = "c:/Users/austi/OneDrive/Desktop/Antigravity/frontend/src/pages/TenderIngest.tsx"
with open(ingest_path, "r") as f: content = f.read()

payload_old = """                    mandatory_docs: manualForm.mandatoryDocs ? Object.entries(manualForm.mandatoryDocs).filter(([_, v]) => v).map(([k]) => k) : []
                }
            })"""
payload_new = """                    mandatory_docs: manualForm.mandatoryDocs ? Object.entries(manualForm.mandatoryDocs).filter(([_, v]) => v).map(([k]) => k) : []
                }
            }, isDraft)"""

content = content.replace(payload_old, payload_new)
with open(ingest_path, "w") as f: f.write(content)
