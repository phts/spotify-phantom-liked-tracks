import {readFileSync, writeFileSync, unlinkSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {app} from './app/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CODE_JSON_PATH = path.resolve(__dirname, 'code.json')
const AUTH_JSON_PATH = path.resolve(__dirname, 'auth.json')
const settingsPath = path.resolve(__dirname, 'settings.json')
const settings = JSON.parse(readFileSync(settingsPath, 'utf8'))

try {
  const {code} = JSON.parse(readFileSync(CODE_JSON_PATH, 'utf8'))
  settings.code = code
} catch (e) {
  // ignore
}

try {
  const {accessToken, refreshToken} = JSON.parse(readFileSync(AUTH_JSON_PATH, 'utf8'))
  settings.accessToken = accessToken
  settings.refreshToken = refreshToken
} catch (e) {
  // ignore
}

function saveCode(code) {
  writeFileSync(CODE_JSON_PATH, JSON.stringify({code}, null, 2))
}
function saveAuth(data) {
  writeFileSync(AUTH_JSON_PATH, JSON.stringify(data, null, 2))
  unlinkSync(CODE_JSON_PATH)
}

app(settings, {saveAuth, saveCode}).catch((e) => {
  console.error(e)
})
