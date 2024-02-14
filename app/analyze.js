import {cached} from './cached.js'
import {fetchPagedData} from './fetchPagedData.js'

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
      console.warn(`Multiple artists: ${album.artists.map((x) => x.name).join(', ')} for album "${album.name}"`)
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
      console.info(`> ${artist.name} - ${fa.name}`)
      const exists = artistAlbums.some((aa) => aa.id === fa.id)
      if (!exists) {
        console.warn(
          `"${fa.name}" [https://open.spotify.com/album/${fa.id}] does not exist in artist [https://open.spotify.com/artist/${artistId}]`
        )
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
      console.warn(`Multiple artists: ${track.artists.map((x) => x.name).join(', ')} for track "${track.name}"`)
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
      console.info(`> ${favTrack.artists[0].name} - ${favTrack.name}`)
      const favTrackAlbum = favTrack.album
      const realTrackAlbum = artistRealAlbums.find((al) => al.name === favTrackAlbum.name)
      if (!realTrackAlbum) {
        console.warn(
          `Real album of track "${favTrack.name}" from album [https://open.spotify.com/album/${favTrack.album}] from artist [https://open.spotify.com/artist/${artistId}]`
        )
        continue
      }

      const {
        body: {items: realAlbumTracks},
      } = await api.getAlbumTracks(realTrackAlbum.id, {limit: 50})

      const realTrack = realAlbumTracks.find((tr) => tr.id === favTrack.id)
      if (!realTrack) {
        console.warn(
          `"${favTrack.name}" from album [https://open.spotify.com/album/${favTrack.album.id}] does not exist in artist [https://open.spotify.com/artist/${artistId}]`
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
