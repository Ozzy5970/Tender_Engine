import sys

api_path = "c:/Users/austi/OneDrive/Desktop/Antigravity/frontend/src/services/api.ts"
with open(api_path, "r") as f: content = f.read()

sig_old = "    async createManualTender(data: ManualTenderData) {"
sig_new = "    async createManualTender(data: ManualTenderData, isDraft: boolean = false) {"
content = content.replace(sig_old, sig_new)

insert_old = """                status: 'ANALYZING', // Will trigger readiness check (simulated) or just set to draft
                compliance_score: 0,"""
insert_new = """                status: isDraft ? 'DRAFT' : 'ANALYZING',
                compliance_score: isDraft ? null : 0,"""
content = content.replace(insert_old, insert_new)

with open(api_path, "w") as f: f.write(content)
