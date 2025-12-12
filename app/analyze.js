import chalk from 'chalk'
import {cached, clearCache} from './cached.js'
import {fetchPagedData} from './fetchPagedData.js'

const COOLDOWN_PERIOD = 200

const VARIOUS_ARTISTS_ID = '0LyfQWJT6nXafLPZqxe9Of'

function trackLink(id) {
  return `https://open.spotify.com/track/${id}`
}
function albumLink(id) {
  return `https://open.spotify.com/album/${id}`
}
function artistLink(id) {
  return `https://open.spotify.com/artist/${id}`
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function getSimilarAlbums(albums, name) {
  return albums
    .filter(
      (al) => al.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(al.name.toLowerCase())
    )
    .map((al) => ({
      id: al.id,
      name: al.name,
      url: albumLink(al.id),
    }))
}

function logSimilarAlbums(albums, name) {
  const similar = getSimilarAlbums(albums, name)
  if (similar.length) {
    console.warn(' ', `Possibly suppressed by:\n${similar.map(({name, url}) => `   "${name}" [${url}]`).join('\n')}`)
  }
}

export async function analyzeFavAlbums(api) {
  console.info('Analyzing favorite albums...')
  clearCache()
  const report = []
  const albums = []
  await fetchPagedData(
    api,
    'getMySavedAlbums',
    {},
    {
      onData: (items) => {
        albums.push(...items)
      },
    }
  )

  const albumsGroupedByArtists = albums.reduce((acc, {album}) => {
    const artistId = album.artists[0].id
    const artistAlbums = acc[artistId] || []
    artistAlbums.push(album)
    acc[artistId] = artistAlbums
    return acc
  }, {})

  for (const [artistId, favAlbums] of Object.entries(albumsGroupedByArtists)) {
    const artist = favAlbums[0].artists[0]

    if (artistId === VARIOUS_ARTISTS_ID) {
      favAlbums.forEach((fa) => {
        report.push({
          artist: {id: artistId, name: artist.name, url: artistLink(artistId)},
          album: {id: fa.id, name: fa.name, url: albumLink(fa.id)},
          warning: {id: 'various-artist'},
          status: 'skip',
        })
        console.warn(chalk.blue('?'), `Album "${fa.name}" has "${artist.name}" as artist. Skipping...`)
        console.info(chalk.green('✓'), `[${albumLink(fa.id)}] ${artist.name} - ${fa.name}`)
      })
      continue
    }
    const artistAlbums = await cached(async () => {
      await wait(COOLDOWN_PERIOD)
      const artistAlbums = []
      await fetchPagedData(
        api,
        'getArtistAlbums',
        {requiredArgs: [artistId]},
        {
          onData: (items) => {
            artistAlbums.push(...items)
          },
        }
      )
      return artistAlbums
    }, `artist/${artistId}`)

    favAlbums.forEach((fa) => {
      const reportEntry = {
        artist: {id: artistId, name: artist.name, url: artistLink(artistId)},
        album: {id: fa.id, name: fa.name, url: albumLink(fa.id)},
      }

      if (fa.artists.length > 1) {
        reportEntry.warning = {id: 'multiple-artists', artists: fa.artists.map((x) => x.name)}
        console.warn(
          chalk.blue('?'),
          `Album "${fa.name}" has multiple artists: ${fa.artists
            .map((x) => x.name)
            .join(', ')}. Processing only the first one...`
        )
      }
      const exists = artistAlbums.some((aa) => aa.id === fa.id)
      if (!exists) {
        reportEntry.status = 'album-not-exist'
        reportEntry.similarAlbums = getSimilarAlbums(artistAlbums, fa.name)
        report.push(reportEntry)
        console.warn(
          chalk.bgRed('!'),
          `Album "${fa.name}" [${albumLink(fa.id)}] does not exist in the artist [${artistLink(artistId)}]`
        )
        logSimilarAlbums(artistAlbums, fa.name)
        return
      }
      reportEntry.status = 'ok'
      report.push(reportEntry)
      console.info(chalk.green('✓'), `[${albumLink(fa.id)}] ${artist.name} - ${fa.name}`)
    })
  }
  return report
}

async function analyzeTracks(api, tracks) {
  clearCache()
  const report = []
  const tracksGroupedByArtistsAndAlbums = tracks.reduce((acc, {track}) => {
    const artistId = track.artists[0].id
    const artistTracks = acc[artistId] || []
    artistTracks.push(track)

    acc[artistId] = artistTracks
    return acc
  }, {})

  for (const [artistId, artistTracks] of Object.entries(tracksGroupedByArtistsAndAlbums)) {
    const artistRealAlbums = await cached(async () => {
      const artistAlbums = []
      await wait(COOLDOWN_PERIOD)
      await fetchPagedData(
        api,
        'getArtistAlbums',
        {requiredArgs: [artistId]},
        {
          onData: (items) => {
            artistAlbums.push(...items)
          },
        }
      )
      return artistAlbums
    }, `artist/${artistId}`)

    for (const favTrack of artistTracks) {
      const reportEntry = {
        track: {
          id: favTrack.id,
          name: favTrack.name,
          url: trackLink(favTrack.id),
        },
        album: {
          id: favTrack.album.id,
          name: favTrack.album.name,
          url: albumLink(favTrack.album.id),
        },
        artist: {
          id: artistId,
          name: favTrack.artists[0].name,
          url: artistLink(artistId),
        },
      }
      if (favTrack.artists.length > 1) {
        reportEntry.warning = {id: 'multiple-artists', artists: favTrack.artists.map((x) => x.name)}
        console.warn(
          chalk.blue('?'),
          `Track "${favTrack.name}" has multiple artists: ${favTrack.artists
            .map((x) => x.name)
            .join(', ')}. Processing only the first one...`
        )
      }

      const realTrackAlbum = artistRealAlbums.find((al) => al.id === favTrack.album.id)
      if (!realTrackAlbum) {
        reportEntry.status = 'album-not-exist'
        reportEntry.similarAlbums = getSimilarAlbums(artistRealAlbums, favTrack.album.name)
        report.push(reportEntry)
        console.warn(
          chalk.bgRed('!'),
          `Track "${favTrack.name}" [${trackLink(favTrack.id)}] belongs to the album [${albumLink(
            favTrack.album.id
          )}] which does not exist in the artist [${artistLink(artistId)}]`
        )
        logSimilarAlbums(artistRealAlbums, favTrack.album.name)
        continue
      }

      await wait(COOLDOWN_PERIOD)
      const {
        body: {items: realAlbumTracks},
      } = await api.getAlbumTracks(realTrackAlbum.id, {limit: 50})

      const realTrack = realAlbumTracks.find((tr) => tr.id === favTrack.id)
      if (!realTrack) {
        reportEntry.status = 'track-not-exist'
        report.push(reportEntry)
        console.warn(
          chalk.bgRed('!'),
          `Track "${favTrack.name}" [${trackLink(favTrack.id)}] from the album [${albumLink(
            favTrack.album.id
          )}] does not exist in the artist [${artistLink(artistId)}]`
        )
        continue
      }

      reportEntry.status = 'ok'
      report.push(reportEntry)
      console.info(chalk.green('✓'), `[${trackLink(favTrack.id)}] ${favTrack.artists[0].name} - ${favTrack.name}`)
    }
  }
  return report
}

export async function analyzeFavTracks(api) {
  console.info('Analyzing favorite tracks...')
  const tracks = []
  await fetchPagedData(
    api,
    'getMySavedTracks',
    {},
    {
      onData: (items) => {
        tracks.push(...items)
      },
    }
  )
  return analyzeTracks(api, tracks)
}

export async function analyzePlaylistTracks(api, id) {
  console.info(`Analyzing tracks of the playlist ${id}...`)
  const tracks = []
  await fetchPagedData(
    api,
    'getPlaylistTracks',
    {requiredArgs: [id]},
    {
      onData: (items) => {
        tracks.push(...items)
      },
    }
  )
  return analyzeTracks(api, tracks)
}
