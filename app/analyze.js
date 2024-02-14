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
      '!',
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
    if (album.artists.length > 1) {
      console.warn('?', `Multiple artists: ${album.artists.map((x) => x.name).join(', ')} for album "${album.name}"`)
    }
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
      console.info(`> [${albumLink(fa.id)}] ${artist.name} - ${fa.name}`)
      const exists = artistAlbums.some((aa) => aa.id === fa.id)
      if (!exists) {
        console.warn(
          '!',
          `Album "${fa.name}" [${albumLink(fa.id)}] does not exist in the artist [${artistLink(artistId)}]`
        )
        logSimilarAlbums(artistAlbums, fa.name)
      }
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
    if (track.artists.length > 1) {
      console.warn(
        '?',
        `Multiple artists: ${track.artists.map((x) => x.name).join(', ')} for the track "${track.name}"`
      )
    }
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
      console.info(`> [${trackLink(favTrack.id)}] ${favTrack.artists[0].name} - ${favTrack.name}`)
      const realTrackAlbum = artistRealAlbums.find((al) => al.id === favTrack.album.id)
      if (!realTrackAlbum) {
        console.warn(
          '!',
          `Track "${favTrack.name}" belongs to the album [${albumLink(
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
          '!',
          `Track "${favTrack.name}" from the album [${albumLink(
            favTrack.album.id
          )}] does not exist in the artist [${artistLink(artistId)}]`
        )
        continue
      }
    }
  }
}

export async function analyze(api) {
  await analyzeAlbums(api)
  await analyzeTracks(api)
}
