
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

// --- CONFIGURATION ---
const KEEPER_EMAIL = 'austin.simonsps@gmail.com'
const KEEPER_UUID = 'faaaf0ba-77d3-4fc6-b3c7-21bf04b55400'
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// --- SETUP ---
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 1. Try to load .env from scripts directory
const scriptsEnvPath = path.resolve(__dirname, '.env')
if (fs.existsSync(scriptsEnvPath)) {
    console.log(`Loading env from: ${scriptsEnvPath}`)
    dotenv.config({ path: scriptsEnvPath })
} else {
    // 2. Fallback to project root .env
    const rootEnvPath = path.resolve(__dirname, '../.env')
    if (fs.existsSync(rootEnvPath)) {
        console.log(`Loading env from: ${rootEnvPath}`)
        dotenv.config({ path: rootEnvPath })
    }
}

// Expect standard Supabase env vars
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

const IS_EXECUTE = process.argv.includes('--execute')

// --- HELPERS ---

// New Helper: Check if path starts with KEEPER_UUID
function isKeeperFolder(fullPath) {
    const first = String(fullPath || '').split('/')[0]
    return first?.toLowerCase() === KEEPER_UUID.toLowerCase()
}

// Recursively list all files in a bucket with robust folder detection
async function listAllFiles(bucket, path = '') {
    let allFiles = []
    let page = 0
    const limit = 100
    let hasMore = true
    let loopCount = 0
    const maxLoops = 500 // 50,000 files safeguard

    while (hasMore && loopCount < maxLoops) {
        loopCount++
        const { data, error } = await supabase.storage
            .from(bucket)
            .list(path, { limit, offset: page * limit })

        if (error) {
            console.error(`❌ Error scanning ${bucket}/${path}:`, error.message)
            return allFiles
        }

        if (!data || data.length === 0) {
            hasMore = false
            break
        }

        for (const item of data) {
            const isFolder =
                item.id === null ||
                (item.metadata === null && item.updated_at === null) ||
                (item.name && item.id === undefined);

            if (isFolder) {
                const subFiles = await listAllFiles(bucket, `${path ? path + '/' : ''}${item.name}`)
                allFiles = allFiles.concat(subFiles)
            } else {
                item.fullPath = path ? `${path}/${item.name}` : item.name
                allFiles.push(item)
            }
        }

        if (data.length < limit) hasMore = false
        else page++
    }
    return allFiles
}

async function batchDelete(bucket, paths) {
    const batchSize = 100
    let deletedCount = 0

    for (let i = 0; i < paths.length; i += batchSize) {
        const batch = paths.slice(i, i + batchSize)
        const { error, data } = await supabase.storage
            .from(bucket)
            .remove(batch)

        if (error) {
            console.error(`❌ Error deleting batch in ${bucket}:`, error.message)
        } else {
            deletedCount += (data?.length || 0)
            process.stdout.write('.')
        }
    }
    console.log()
    return deletedCount
}

// Helper to normalize keys (remove buckets, leading slashes, etc)
function normalizeStorageKey(key, bucket) {
    if (!key) return null
    let k = String(key).trim()
    try { k = decodeURIComponent(k) } catch { }

    // Remove leading slash if any
    if (k.startsWith('/')) k = k.slice(1)

    // Remove bucket prefix if present (e.g. "compliance/path/to/file")
    if (k.startsWith(bucket + '/')) {
        k = k.slice(bucket.length + 1)
    }

    return k
}

function extractStoragePath(rawPath, bucket) {
    let extracted = rawPath
    if (!rawPath) return null

    if (rawPath.startsWith('http')) {
        try {
            const url = new URL(rawPath)
            const parts = url.pathname.split(`/${bucket}/`)
            if (parts.length > 1) {
                extracted = decodeURIComponent(parts[1])
            }
        } catch (e) { }
    }

    return normalizeStorageKey(extracted, bucket)
}

// A) Add a helper to pick first existing column
async function pickFirstExistingColumn({ table, candidates }) {
    for (const col of candidates) {
        // We use a simple select limit 1 to probe existence
        const { error } = await supabase.from(table).select(col).limit(1)
        if (!error) {
            return col
        }
    }
    return null
}

// --- ALLOWLIST LOGIC ---

// B) Compliance allowlist (STRICT, DB-driven, FAIL-SAFE)
async function getComplianceAllowlist() {
    console.log(`   > Building allowlist for 'compliance' from DB...`)
    const TABLE = 'compliance_documents'
    const CANDIDATES = ['storage_path', 'file_path', 'file_url', 'document_url', 'object_path', 'path', 'url']

    const pathCol = await pickFirstExistingColumn({ table: TABLE, candidates: CANDIDATES })

    if (!pathCol) {
        console.error(`\n❌ CRITICAL ERROR: Could not find any valid path column in '${TABLE}'.`)
        console.error(`   ABORTING to prevent data loss.`)
        process.exit(1)
    }
    console.log(`   > Found path column: ${pathCol}`)

    const { data, error } = await supabase
        .from(TABLE)
        .select(pathCol)
        .eq('user_id', KEEPER_UUID)

    if (error) {
        console.error(`\n❌ CRITICAL ERROR: Query failed on '${TABLE}'.`, error.message)
        process.exit(1)
    }

    const allowlist = new Set()
    if (data) {
        for (const row of data) {
            const val = row[pathCol]
            const extracted = extractStoragePath(val, 'compliance')
            if (extracted) allowlist.add(extracted)
        }
    }

    console.log(`   > Found ${allowlist.size} protected files for Keeper in DB.`)
    return allowlist
}

// D) Tenders allowlist (Best effort)
async function getTendersAllowlist() {
    console.log(`   > Building allowlist for 'tenders_documents' from DB...`)

    const { data: tendersData, error: tendersError } = await supabase
        .from('tenders')
        .select('id')
        .eq('user_id', KEEPER_UUID)

    if (tendersError || !tendersData) {
        console.log(`   > Could not query 'tenders' table (${tendersError?.message}). Fallback to UUID rule.`)
        return null
    }

    const keeperTenderIds = tendersData.map(t => t.id)
    if (keeperTenderIds.length === 0) {
        console.log(`   > Keeper has 0 tenders. Allowlist is empty (safe).`)
        return new Set()
    }

    const DOC_TABLES = ['tender_documents', 'tender_files', 'tender_attachments']
    let foundTable = null
    let foundPathCol = null
    const CANDIDATES = ['storage_path', 'file_path', 'file_url', 'document_url', 'object_path', 'path', 'url']

    for (const t of DOC_TABLES) {
        const hasTenderId = await pickFirstExistingColumn({ table: t, candidates: ['tender_id'] })
        if (hasTenderId) {
            const pathCol = await pickFirstExistingColumn({ table: t, candidates: CANDIDATES })
            if (pathCol) {
                foundTable = t
                foundPathCol = pathCol
                break
            }
        }
    }

    if (!foundTable) {
        console.log(`   > No suitable tender docs table found. Fallback to UUID rule.`)
        return null
    }

    console.log(`   > Found docs table: '${foundTable}' using column: '${foundPathCol}'`)

    const { data: docsData, error: docsError } = await supabase
        .from(foundTable)
        .select(foundPathCol)
        .in('tender_id', keeperTenderIds)

    if (docsError) {
        console.log(`   > Error querying ${foundTable}: ${docsError.message}. Fallback to UUID rule.`)
        return null
    }

    const allowlist = new Set()
    if (docsData) {
        for (const row of docsData) {
            const val = row[foundPathCol]
            const extracted = extractStoragePath(val, 'tenders_documents')
            if (extracted) allowlist.add(extracted)
        }
    }

    console.log(`   > Found ${allowlist.size} protected files in ${foundTable}.`)
    return allowlist
}


// --- MAIN LOGIC ---

async function purgeStorage() {
    console.log("\n🧹 SUPABASE STORAGE PURGE TOOL (Final Strict)")
    console.log("=============================================")
    console.log(`Target: ${SUPABASE_URL}`)
    console.log(`Keeper: ${KEEPER_EMAIL} (${KEEPER_UUID})`)
    console.log(`Mode:   ${IS_EXECUTE ? '🚨 EXECUTE (DESTRUCTIVE) 🚨' : '🧪 DRY RUN'}`)
    console.log("---------------------------------------------\n")

    // 1. TENDERS_DOCUMENTS
    // ----------------------------------------------------------------
    console.log(`🔍 Bucket: 'tenders_documents'`)
    const tendersAllowlist = await getTendersAllowlist()
    const tendersFiles = await listAllFiles('tenders_documents')
    const tendersToDelete = []

    // Warning
    if (tendersAllowlist && tendersAllowlist.size === 0 && tendersFiles.length > 0) {
        console.warn(`   ⚠️  WARNING: DB returned 0 protected files!`)
        console.warn(`       Reliance is strictly on isKeeperFolder() safety check.`)
    }

    for (const file of tendersFiles) {
        let shouldDelete = false

        if (tendersAllowlist) {
            // DB Strategy: Delete if NOT in allowlist (Normalized)
            // SAFETY PATCH: Never delete keeper folder regardless of allowlist
            if (isKeeperFolder(file.fullPath)) {
                shouldDelete = false
            } else {
                const normKey = normalizeStorageKey(file.fullPath, 'tenders_documents')
                if (!tendersAllowlist.has(normKey)) {
                    shouldDelete = true
                }
            }
        } else {
            // Fallback Strategy: UUID Folder Rule
            const segments = file.fullPath.split('/')
            if (segments.length > 0) {
                if (UUID_REGEX.test(segments[0])) {
                    if (segments[0].toLowerCase() !== KEEPER_UUID.toLowerCase()) {
                        shouldDelete = true
                    }
                }
            }
        }

        if (shouldDelete) tendersToDelete.push(file.fullPath)
    }

    console.log(`   - Total Scanned: ${tendersFiles.length}`)
    console.log(`   - To Delete:     ${tendersToDelete.length}`)
    if (tendersToDelete.length > 0) {
        console.log(`   - Examples:\n     ${tendersToDelete.slice(0, 10).join('\n     ')}`)
    }

    // 2. COMPLIANCE
    // ----------------------------------------------------------------
    console.log(`\n🔍 Bucket: 'compliance'`)
    const complianceAllowlist = await getComplianceAllowlist() // Will exit process if fails
    const complianceFiles = await listAllFiles('compliance')
    const complianceToDelete = []

    // Warning
    if (complianceAllowlist.size === 0 && complianceFiles.length > 0) {
        console.warn(`   ⚠️  WARNING: DB returned 0 protected files!`)
        console.warn(`       Reliance is strictly on isKeeperFolder() safety check.`)
    }

    for (const file of complianceFiles) {
        // C) Compliance delete rule:
        // SAFETY PATCH: Always keep keeper folder
        if (isKeeperFolder(file.fullPath)) {
            // Safe
        } else {
            // Delete every object whose normalized path is NOT in allowlist.
            const normKey = normalizeStorageKey(file.fullPath, 'compliance')
            if (!complianceAllowlist.has(normKey)) {
                complianceToDelete.push(file.fullPath)
            }
        }
    }

    console.log(`   - Total Scanned: ${complianceFiles.length}`)
    console.log(`   - Allowlist Size: ${complianceAllowlist.size}`)
    console.log(`   - To Delete:     ${complianceToDelete.length}`)
    if (complianceToDelete.length > 0) {
        console.log(`   - Examples:\n     ${complianceToDelete.slice(0, 10).join('\n     ')}`)
    }

    // 3. TEMPLATES (Preserve)
    console.log(`\n🛡️  Bucket: 'templates' will be PRESERVED (Skipping scan).`)

    // --- EXECUTION PHASE ---
    const totalToDelete = tendersToDelete.length + complianceToDelete.length

    if (totalToDelete === 0) {
        console.log("\n✅ No files matched deletion criteria.")
        return
    }

    console.log(`\nSUMMARY: Found ${totalToDelete} files to delete across buckets.`)

    if (!IS_EXECUTE) {
        console.log("\n🧪 DRY RUN COMPLETE. Use --execute to proceed with deletion.")
        return
    }

    console.log("\n🚨 STARTING DELETION... (Ctrl+C to stop)")

    // Delete Tenders
    if (tendersToDelete.length > 0) {
        console.log(`\nDeleting ${tendersToDelete.length} files from 'tenders_documents'...`)
        await batchDelete('tenders_documents', tendersToDelete)
    }

    // Delete Compliance
    if (complianceToDelete.length > 0) {
        console.log(`\nDeleting ${complianceToDelete.length} files from 'compliance'...`)
        await batchDelete('compliance', complianceToDelete)
    }

    console.log("\n✨ Purge Complete.")
}

purgeStorage().catch(err => {
    console.error("Fatal Error:", err)
    process.exit(1)
})
