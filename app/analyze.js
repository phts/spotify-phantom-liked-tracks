import chalk from 'chalk'
import {cached} from './cached.js'
import {fetchPagedData} from './fetchPagedData.js'

const COOLDOWN_PERIOD = 200

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

function logSimilarAlbums(albums, name) {
  const similar = albums.filter(
    (al) => al.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(al.name.toLowerCase())
  )
  if (similar.length) {
    console.warn(
      chalk.yellow('!'),
      `Possibly suppressed by:\n${similar.map((c) => `   "${c.name}" [${albumLink(c.id)}]`).join('\n')}`
    )
  }
}

async function analyzeAlbums(api) {
  console.info('Analyzing albums...')
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
      if (fa.artists.length > 1) {
        console.warn(
          chalk.blue('?'),
          `Album "${fa.name}" has multiple artists: ${fa.artists
            .map((x) => x.name)
            .join(', ')}. Processing only the first one...`
        )
      }
      const exists = artistAlbums.some((aa) => aa.id === fa.id)
      if (!exists) {
        console.warn(
          chalk.yellow('!'),
          `Album "${fa.name}" [${albumLink(fa.id)}] does not exist in the artist [${artistLink(artistId)}]`
        )
        logSimilarAlbums(artistAlbums, fa.name)
      }
      console.info(chalk.green('✓'), `[${albumLink(fa.id)}] ${artist.name} - ${fa.name}`)
    })
  }
}

async function analyzeTracks(api) {
  console.info('Analyzing tracks...')
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
      if (favTrack.artists.length > 1) {
        console.warn(
          chalk.blue('?'),
          `Track "${favTrack.name}" has multiple artists: ${favTrack.artists
            .map((x) => x.name)
            .join(', ')}. Processing only the first one...`
        )
      }

      const realTrackAlbum = artistRealAlbums.find((al) => al.id === favTrack.album.id)
      if (!realTrackAlbum) {
        console.warn(
          chalk.yellow('!'),
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
        console.warn(
          chalk.yellow('!'),
          `Track "${favTrack.name}" [${trackLink(favTrack.id)}] from the album [${albumLink(
            favTrack.album.id
          )}] does not exist in the artist [${artistLink(artistId)}]`
        )
        continue
      }

      console.info(chalk.green('✓'), `[${trackLink(favTrack.id)}] ${favTrack.artists[0].name} - ${favTrack.name}`)
    }
  }
}

export async function analyze(api) {
  await analyzeAlbums(api)
  await analyzeTracks(api)
}
