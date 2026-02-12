
$ErrorActionPreference = "Stop"

$artifactPath = "C:\Users\austi\.gemini\antigravity\brain\0d094424-fa25-45dc-8840-fdb279ddcbd7\chatgpt_context_package.md"

# Initialize File
Set-Content -Path $artifactPath -Value "# Antigravity Context Export`n`nThis file contains the requested context for ChatGPT analysis." -Encoding UTF8

function Append-Section {
    param (
        [string]$Title,
        [string]$FilePath,
        [string]$Lang
    )

    Add-Content -Path $artifactPath -Value "`n## $Title"
    if ($FilePath) {
        Add-Content -Path $artifactPath -Value "**File:** ``$FilePath``"
        Add-Content -Path $artifactPath -Value "```$Lang"
        # Read file content and append. preserve encoding is tricky, Get-Content reads lines.
        # We want to preserve content exactly.
        $content = Get-Content -Path $FilePath -Raw
        Add-Content -Path $artifactPath -Value $content
        Add-Content -Path $artifactPath -Value "```"
    }
}

function Append-Text {
    param (
        [string]$Title,
        [string]$Text,
        [string]$Lang
    )
    Add-Content -Path $artifactPath -Value "`n## $Title"
    Add-Content -Path $artifactPath -Value "```$Lang"
    Add-Content -Path $artifactPath -Value $Text
    Add-Content -Path $artifactPath -Value "```"
}

# 1. API Service
Append-Section -Title "1. Frontend API Service" -FilePath "frontend\src\services\api.ts" -Lang "typescript"

# 2. Revenue Page
Append-Section -Title "2. Frontend Revenue Page" -FilePath "frontend\src\pages\AdminRevenue.tsx" -Lang "tsx"

# 3. Dashboard Page
Append-Section -Title "3. Frontend Dashboard Page" -FilePath "frontend\src\pages\AdminDashboard.tsx" -Lang "tsx"

# 4. Types
Append-Section -Title "4. Frontend Types" -FilePath "frontend\src\types\api.ts" -Lang "typescript"

# 5. SQL Definitions
Add-Content -Path $artifactPath -Value "`n## 5. SQL Definitions"

# Dashboard Snapshot SQL
Add-Content -Path $artifactPath -Value "`n### get_admin_dashboard_snapshot"
Add-Content -Path $artifactPath -Value "```sql"
$sql1 = Get-Content -Path "supabase\migrations\20260209190000_dashboard_revenue_30d.sql" -Raw
Add-Content -Path $artifactPath -Value $sql1
Add-Content -Path $artifactPath -Value "```"

# Revenue Ledger SQL
Add-Content -Path $artifactPath -Value "`n### get_admin_revenue_ledger"
Add-Content -Path $artifactPath -Value "```sql"
$sql2 = Get-Content -Path "supabase\migrations\20260209120000_get_admin_revenue_ledger.sql" -Raw
Add-Content -Path $artifactPath -Value $sql2
Add-Content -Path $artifactPath -Value "```"

# 6. Real Sample Data
Add-Content -Path $artifactPath -Value "`n## 6. Real Sample Data (Live Fetch)"
$jsonContent = Get-Content -Path "dossier_data.json" -Raw | ConvertFrom-Json

Add-Content -Path $artifactPath -Value "`n### get_admin_dashboard_snapshot Response"
Add-Content -Path $artifactPath -Value "```json"
# Use -Depth 10 to ensure nested objects are fully expanded
$snapJson = $jsonContent.snapshot | ConvertTo-Json -Depth 10
Add-Content -Path $artifactPath -Value $snapJson
Add-Content -Path $artifactPath -Value "```"

Add-Content -Path $artifactPath -Value "`n### get_admin_revenue_ledger Response (30D)"
Add-Content -Path $artifactPath -Value "```json"
$ledgerJson = $jsonContent.ledger | ConvertTo-Json -Depth 10
Add-Content -Path $artifactPath -Value $ledgerJson
Add-Content -Path $artifactPath -Value "```"

Write-Host "Export complete!"
