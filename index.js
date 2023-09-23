import {writeFileSync} from 'fs'
import path from 'path'
import {fileURLToPath} from 'url'
import {app} from './app/index.js'
import settings from './settings.json' assert {type: 'json'}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

try {
  const {
    default: {code},
  } = await import('./code.json', {assert: {type: 'json'}})
  settings.code = code
} catch (e) {
  console.warn(`No code.json: ${e}`)
}

try {
  const {
    default: {accessToken, refreshToken},
  } = await import('./auth.json', {assert: {type: 'json'}})
  settings.code = null
  settings.accessToken = accessToken
  settings.refreshToken = refreshToken
} catch (e) {
  console.warn(`No auth.json: ${e}`)
}

function storeAuth(data) {
  writeFileSync(path.resolve(__dirname, 'auth.json'), JSON.stringify(data, null, 2))
}

app(settings, storeAuth).catch((e) => {
  console.error(e)
})
