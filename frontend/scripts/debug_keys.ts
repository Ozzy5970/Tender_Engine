
import dotenv from 'dotenv'
import path from 'path'

console.log("Current Dir:", process.cwd())
const result = dotenv.config({ path: '../.env' })
console.log("Dotenv parsed:", result.parsed ? Object.keys(result.parsed) : "None")
console.log("Error:", result.error)

console.log("VITE_SUPABASE_URL:", process.env.VITE_SUPABASE_URL ? "Existent" : "Missing")
console.log("SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "Existent" : "Missing")
