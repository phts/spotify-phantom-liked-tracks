import {readFileSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const settingsPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'settings.json')
let settings

try {
  settings = JSON.parse(readFileSync(settingsPath, 'utf8'))
} catch {
  console.error('File app/settings.json with Client ID and Client secret is missing.')
  process.exit(1)
}

export {settings}
