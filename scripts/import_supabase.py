import sys

tenders_path = "c:/Users/austi/OneDrive/Desktop/Antigravity/frontend/src/pages/Tenders.tsx"
with open(tenders_path, "r") as f: content = f.read()

content = content.replace("import { formatTenderDate, isTenderExpired } from \"@/lib/dateUtils\"", "import { formatTenderDate, isTenderExpired } from \"@/lib/dateUtils\"\nimport { supabase } from \"@/lib/supabase\"")

with open(tenders_path, "w") as f: f.write(content)
