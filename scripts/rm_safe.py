import sys

details_path = "c:/Users/austi/OneDrive/Desktop/Antigravity/frontend/src/pages/TenderDetails.tsx"
with open(details_path, "r") as f: content = f.read()

content = content.replace("    const isSafeToSubmit = score >= 100\n", "")

with open(details_path, "w") as f: f.write(content)
