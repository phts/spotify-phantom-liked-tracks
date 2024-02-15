import SpotifyWebApi from 'spotify-web-api-node'
import {WebapiError} from 'spotify-web-api-node/src/response-error.js'
import {analyze} from './analyze.js'

function createAuthorizeURL(api) {
  const scopes = ['user-library-read']
  return api.createAuthorizeURL(scopes)
}

async function askToAuthorize(api, {saveCode}) {
  console.info(
    'Open the link below, authorize the app and copy/paste the URL from address bar in the browser back to the terminal'
  )
  console.info(createAuthorizeURL(api))

  const url = await new Promise(async (resolve) => {
    const readline = (await import('node:readline')).createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    readline.question(`Paste the new URL here:`, (url) => {
      readline.close()
      resolve(url)
    })
  })
  const codeUrl = new URL(url)
  const code = codeUrl.searchParams.get('code')
  if (!code) {
    throw new Error('Provided URL does not contain authorization code')
  }
  saveCode(code)
  console.info('Authorization code is saved')
}

async function initApi(settings, {saveAuth, saveCode}) {
  const api = new SpotifyWebApi({
    clientId: settings.clientId,
    clientSecret: settings.clientSecret,
    redirectUri: 'http://localhost',
  })
  if (settings.code) {
    const data = await api.authorizationCodeGrant(settings.code)
    const accessToken = data.body.access_token
    const refreshToken = data.body.refresh_token
    settings.accessToken = accessToken
    settings.refreshToken = refreshToken
    saveAuth({accessToken, refreshToken})
  }

  if (settings.accessToken && settings.refreshToken) {
    api.setAccessToken(settings.accessToken)
    api.setRefreshToken(settings.refreshToken)
  }

  try {
    // check if authorized
    await api.containsMySavedTracks(['7ouMYWpwJ422jRcDASZB7P'])
    return api
  } catch (e) {
    if (e.statusCode === 400 || e.statusCode === 401) {
      console.info('Authorization is required')
      await askToAuthorize(api, {saveCode})
      console.info('Restart the application')
      process.exit(0)
    }
    throw e
  }
}

export async function app(settings, callbacks) {
  const api = await initApi(settings, callbacks)

  try {
    await analyze(api)
  } catch (e) {
    if (e.statusCode === 429) {
      console.error('Spotify API method failed due to "Too many requests". Try again later.')
      return
    }
    if (e instanceof WebapiError) {
      console.error(e.message.toString())
      console.error(e.body)
      console.error(e.headers)
      console.error(e.statusCode)
    }
    throw e
  }
}
