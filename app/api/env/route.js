import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const ENV_FILE_PATH = path.join(process.cwd(), ".env")

// Helper to parse .env file content into key-value map and line metadata
function parseEnvContent(content) {
  const envObj = {}
  const lines = content.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const equalIndex = line.indexOf("=")
    if (equalIndex !== -1) {
      const key = line.slice(0, equalIndex).trim()
      let value = line.slice(equalIndex + 1).trim()

      // Strip surrounding quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      if (key) {
        envObj[key] = value
      }
    }
  }

  return envObj
}

// Helper to update specific keys in existing content while preserving comments & ordering
function updateEnvString(existingContent, updates) {
  const lines = existingContent ? existingContent.split(/\r?\n/) : []
  const remainingKeys = { ...updates }
  const newLines = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) {
      newLines.push(line)
      continue
    }

    const equalIndex = line.indexOf("=")
    if (equalIndex !== -1) {
      const key = line.slice(0, equalIndex).trim()
      if (key in remainingKeys) {
        const val = remainingKeys[key]
        if (val !== null && val !== undefined) {
          newLines.push(`${key}=${val}`)
        }
        delete remainingKeys[key]
        continue
      }
    }
    newLines.push(line)
  }

  // Append any newly added keys
  Object.entries(remainingKeys).forEach(([key, val]) => {
    if (val !== null && val !== undefined && key.trim()) {
      newLines.push(`${key.trim()}=${val}`)
    }
  })

  // Ensure trailing newline
  let result = newLines.join("\n")
  if (!result.endsWith("\n")) {
    result += "\n"
  }
  return result
}

export async function GET() {
  try {
    let rawContent = ""
    let mtime = null
    let size = 0

    if (fs.existsSync(ENV_FILE_PATH)) {
      rawContent = fs.readFileSync(ENV_FILE_PATH, "utf-8")
      const stats = fs.statSync(ENV_FILE_PATH)
      mtime = stats.mtime
      size = stats.size
    } else {
      // If .env doesn't exist, create default
      rawContent = `NEXT_PUBLIC_API_URL=http://localhost:8000/api\nNEXT_PUBLIC_SCRAPER_URL=http://localhost:3001/api\n`
      fs.writeFileSync(ENV_FILE_PATH, rawContent, "utf-8")
      const stats = fs.statSync(ENV_FILE_PATH)
      mtime = stats.mtime
      size = stats.size
    }

    const parsedEnv = parseEnvContent(rawContent)

    return NextResponse.json({
      success: true,
      env: parsedEnv,
      raw: rawContent,
      lastModified: mtime,
      sizeBytes: size,
      filePath: ".env"
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to read .env file"
      },
      { status: 500 }
    )
  }
}

export async function POST(req) {
  try {
    const body = await req.json()
    let contentToWrite = ""

    if (typeof body.raw === "string") {
      contentToWrite = body.raw
    } else if (body.updates && typeof body.updates === "object") {
      let currentContent = ""
      if (fs.existsSync(ENV_FILE_PATH)) {
        currentContent = fs.readFileSync(ENV_FILE_PATH, "utf-8")
      }
      contentToWrite = updateEnvString(currentContent, body.updates)
    } else if (body.env && typeof body.env === "object") {
      // Generate clean key=value
      const lines = Object.entries(body.env)
        .filter(([k]) => Boolean(k && k.trim()))
        .map(([k, v]) => `${k.trim()}=${v ?? ""}`)
      contentToWrite = lines.join("\n") + "\n"
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid payload. Provide 'raw', 'updates', or 'env'." },
        { status: 400 }
      )
    }

    // Ensure trailing newline
    if (contentToWrite && !contentToWrite.endsWith("\n")) {
      contentToWrite += "\n"
    }

    fs.writeFileSync(ENV_FILE_PATH, contentToWrite, "utf-8")
    const stats = fs.statSync(ENV_FILE_PATH)
    const parsedEnv = parseEnvContent(contentToWrite)

    return NextResponse.json({
      success: true,
      message: "Frontend .env file saved successfully",
      env: parsedEnv,
      raw: contentToWrite,
      lastModified: stats.mtime,
      sizeBytes: stats.size,
      filePath: ".env"
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to write .env file"
      },
      { status: 500 }
    )
  }
}
