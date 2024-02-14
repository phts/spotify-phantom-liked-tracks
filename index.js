import {writeFileSync, unlinkSync} from 'fs'
import path from 'path'
import {fileURLToPath} from 'url'
import {app} from './app/index.js'
import settings from './settings.json' assert {type: 'json'}

const __filename = fileURLToPath(import.meta.url)
const CODE_JSON_PATH = path.resolve(path.dirname(__filename), 'code.json')
const AUTH_JSON_PATH = path.resolve(path.dirname(__filename), 'auth.json')

try {
  const {
    default: {code},
  } = await import('./code.json', {assert: {type: 'json'}})
  settings.code = code
} catch (e) {
  // ignore
}

try {
  const {
    default: {accessToken, refreshToken},
  } = await import('./auth.json', {assert: {type: 'json'}})
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
