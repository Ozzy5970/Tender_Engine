
$ErrorActionPreference = "Stop"
$artifactPath = "C:\Users\austi\.gemini\antigravity\brain\0d094424-fa25-45dc-8840-fdb279ddcbd7\chatgpt_context_package.md"

# Initialize
Set-Content -Path $artifactPath -Value "# Antigravity Context Export`n`nThis file contains the requested context for ChatGPT analysis." -Encoding UTF8

# 1. API Service
Add-Content -Path $artifactPath -Value "`n## 1. Frontend API Service"
Add-Content -Path $artifactPath -Value '**File:** `frontend\src\services\api.ts`'
Add-Content -Path $artifactPath -Value '```typescript'
$c1 = Get-Content -Path "frontend\src\services\api.ts" -Raw
Add-Content -Path $artifactPath -Value $c1
Add-Content -Path $artifactPath -Value '```'

# 2. Revenue Page
Add-Content -Path $artifactPath -Value "`n## 2. Frontend Revenue Page"
Add-Content -Path $artifactPath -Value '**File:** `frontend\src\pages\AdminRevenue.tsx`'
Add-Content -Path $artifactPath -Value '```tsx'
$c2 = Get-Content -Path "frontend\src\pages\AdminRevenue.tsx" -Raw
Add-Content -Path $artifactPath -Value $c2
Add-Content -Path $artifactPath -Value '```'

# 3. Dashboard Page
Add-Content -Path $artifactPath -Value "`n## 3. Frontend Dashboard Page"
Add-Content -Path $artifactPath -Value '**File:** `frontend\src\pages\AdminDashboard.tsx`'
Add-Content -Path $artifactPath -Value '```tsx'
$c3 = Get-Content -Path "frontend\src\pages\AdminDashboard.tsx" -Raw
Add-Content -Path $artifactPath -Value $c3
Add-Content -Path $artifactPath -Value '```'

# 4. Types
Add-Content -Path $artifactPath -Value "`n## 4. Frontend Types"
Add-Content -Path $artifactPath -Value '**File:** `frontend\src\types\api.ts`'
Add-Content -Path $artifactPath -Value '```typescript'
$c4 = Get-Content -Path "frontend\src\types\api.ts" -Raw
Add-Content -Path $artifactPath -Value $c4
Add-Content -Path $artifactPath -Value '```'

# 5. SQL
Add-Content -Path $artifactPath -Value "`n## 5. SQL Definitions"

Add-Content -Path $artifactPath -Value "`n### get_admin_dashboard_snapshot"
Add-Content -Path $artifactPath -Value '```sql'
$sql1 = Get-Content -Path "supabase\migrations\20260209190000_dashboard_revenue_30d.sql" -Raw
Add-Content -Path $artifactPath -Value $sql1
Add-Content -Path $artifactPath -Value '```'

Add-Content -Path $artifactPath -Value "`n### get_admin_revenue_ledger"
Add-Content -Path $artifactPath -Value '```sql'
$sql2 = Get-Content -Path "supabase\migrations\20260209120000_get_admin_revenue_ledger.sql" -Raw
Add-Content -Path $artifactPath -Value $sql2
Add-Content -Path $artifactPath -Value '```'

# 6. JSON
Add-Content -Path $artifactPath -Value "`n## 6. Real Sample Data (Live Fetch)"
$jsonContent = Get-Content -Path "dossier_data.json" -Raw | ConvertFrom-Json

Add-Content -Path $artifactPath -Value "`n### get_admin_dashboard_snapshot Response"
Add-Content -Path $artifactPath -Value '```json'
$snapJson = $jsonContent.snapshot | ConvertTo-Json -Depth 10
Add-Content -Path $artifactPath -Value $snapJson
Add-Content -Path $artifactPath -Value '```'

Add-Content -Path $artifactPath -Value "`n### get_admin_revenue_ledger Response (30D)"
Add-Content -Path $artifactPath -Value '```json'
$ledgerJson = $jsonContent.ledger | ConvertTo-Json -Depth 10
Add-Content -Path $artifactPath -Value $ledgerJson
Add-Content -Path $artifactPath -Value '```'

Write-Host "Export complete!"
