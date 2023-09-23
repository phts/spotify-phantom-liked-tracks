import SpotifyWebApi from 'spotify-web-api-node'
import {analyze} from './analyze.js'

function createAuthorizeURL(api) {
  const scopes = ['user-library-read']
  return api.createAuthorizeURL(scopes)
}

export async function app(settings, storeAuth) {
  const api = new SpotifyWebApi({
    clientId: settings.clientId,
    clientSecret: settings.clientSecret,
    redirectUri: settings.redirectUri,
  })

  if (settings.code) {
    try {
      const data = await api.authorizationCodeGrant(settings.code)
      const accessToken = data.body.access_token
      const refreshToken = data.body.refresh_token
      console.info('The token expires in ' + data.body.expires_in)
      console.info('The access token is ' + accessToken)
      console.info('The refresh token is ' + refreshToken)
      settings.accessToken = accessToken
      settings.refreshToken = refreshToken
      storeAuth({accessToken, refreshToken})
    } catch (e) {
      if (e.statusCode === 400) {
        console.error('Authorization code expired')
        console.info(createAuthorizeURL(api))
        return
      }
      throw e
    }
  }

  if (settings.accessToken && settings.refreshToken) {
    api.setAccessToken(settings.accessToken)
    api.setRefreshToken(settings.refreshToken)
  }

  try {
    await analyze(api)
  } catch (e) {
    if (e.statusCode === 401) {
      console.error('Not authorized')
      console.info(createAuthorizeURL(api))
      return
    }
    throw e
  }
}
