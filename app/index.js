import {globSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import path from 'node:path'
import express from 'express'
import open from 'open'
import SpotifyWebApi from 'spotify-web-api-node'
import {settings} from './settings.js'
import {analyzeFavAlbums, analyzeFavTracks, analyzePlaylistTracks} from './analyze.js'
import {fetchPagedData} from './fetchPagedData.js'
import {getReportDirPath, getReportFilePath, getReportsDirPath} from './helpers/fs.js'
import {a} from './helpers/html.js'

const PORT = 9876

const api = new SpotifyWebApi({
  clientId: settings.clientId,
  clientSecret: settings.clientSecret,
  redirectUri: `http://127.0.0.1:${PORT}/callback`,
})

let busy = false

const app = express()
app.get('/', async (req, res) => {
  const playlists = []
  await fetchPagedData(
    api,
    'getUserPlaylists',
    {},
    {
      onData: (items) => {
        playlists.push(...items)
      },
    }
  )

  const reports = globSync(path.join(getReportsDirPath(), '**', '*.json')).map((x) => {
    const s = x.split(path.sep)
    return [s[s.length - 2], s[s.length - 1]]
  })

  res.send(`
<p>Analyze:</p>
<ul>
<li><a href="/analyze/fav/albums">❤ Favorite albums</a></li>
<li><a href="/analyze/fav/tracks">❤ Favorite tracks</a></li>
${playlists.map((x) => `<li><a href="/analyze/playlist/${x.id}">${x.name}</a></li>`).join('\n')}
</ul>
<p>Reports:</p>
<ul>
${reports.map(([folder, file]) => `<li><a href="/report/${folder}/${file.replace('.json', '')}">${folder}/${file}</a></li>`).join('\n')}
</ul>
`)
})

app.get('/callback', async (req, res) => {
  const data = await api.authorizationCodeGrant(req.query.code)
  const accessToken = data.body.access_token
  const refreshToken = data.body.refresh_token
  api.setAccessToken(accessToken)
  api.setRefreshToken(refreshToken)
  try {
    // check if authorized
    await api.containsMySavedTracks(['7ouMYWpwJ422jRcDASZB7P'])
    res.redirect('/')
  } catch (e) {
    if (e.statusCode === 400 || e.statusCode === 401) {
      console.info('Authorization failed')
      process.exit(1)
    }
    throw e
  }
})

app.get('/analyze/:folder/:id', async (req, res) => {
  if (busy) {
    res.send('Busy...')
    return
  }
  let report
  if (req.params.folder === 'fav') {
    switch (req.params.id) {
      case 'albums':
        busy = true
        report = await analyzeFavAlbums(api)
        break
      case 'tracks':
        busy = true
        report = await analyzeFavTracks(api)
        break
      default:
        res.sendStatus(404)
        return
    }
  } else if (req.params.folder === 'playlist') {
    busy = true
    report = await analyzePlaylistTracks(api, req.params.id)
  } else {
    res.sendStatus(404)
    return
  }

  busy = false
  mkdirSync(getReportDirPath(req.params.folder), {recursive: true})
  writeFileSync(getReportFilePath(req.params.folder, req.params.id), JSON.stringify(report, null, 2))
  res.redirect(`/report/${req.params.folder}/${req.params.id}`)
})

app.get('/report/:folder/:id', async (req, res) => {
  const json = JSON.parse(readFileSync(getReportFilePath(req.params.folder, req.params.id)).toString())
  const icons = {
    ok: '✅',
    skip: '⚠️',
    'track-not-exist': '❌',
    'album-not-exist': '❌',
  }
  const items = json
    .map((it) => {
      const icon = icons[it.status]
      const title = `${a(it.artist)} - ${it.track ? `${a(it.track)} [${a(it.album)}]` : `${a(it.album)}`}`
      let li = `${icon} ${title}`
      if (it.warning?.id === 'multiple-artists') {
        li += `<p>Belongs to multiple artists: ${it.warning.artists.join(', ')}. Processing only the first one...</p>`
      } else if (it.warning?.id === 'various-artist') {
        li += `<p>Belongs to artist "${it.artist.name}". Skipping...</p>`
      }
      if (it.status === 'album-not-exist') {
        const m = it.track ? `Belongs to the album ${a(it.album)} which` : `Album ${a(it.album)}`
        li += `<p>${m} does not exist in the artist ${a(it.artist)}</p>`
        if (it.similarAlbums.length) {
          li += `<p>Possibly suppressed by:</p>`
          li += `<ul>${it.similarAlbums.map((s) => `<li>${a(s)}</li>`).join('')}</ul>`
        }
      } else if (it.status === 'track-not-exist') {
        li += `<p>Track from the album ${a(it.album)} does not exist in the artist ${a(it.artist)}</p>`
      }
      return `<li>${li}</li>`
    })
    .join('\n')
  res.send(`
<ul>${items}</ul>
`)
})

app.listen(PORT, () => {
  const url = api.createAuthorizeURL(['user-library-read', 'playlist-read-private'])
  console.info('Open the link below and authorize the app:')
  console.info(url)
  console.info('After authorization you will be redirected to a home page.')
  open(url)
})
