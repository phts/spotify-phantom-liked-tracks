import {cached} from './cached.js'

async function analyzeAlbums(api) {
  console.info('Analyzing albums...')
  const {
    body: {total, items: albums},
  } = await api.getMySavedAlbums({limit: 50})
  if (total > 50) {
    console.warn('You have more than 50 albums')
  }
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
    const {
      body: {total, items: artistAlbums},
    } = await cached(() => api.getArtistAlbums(artistId, {limit: 50}), `artist/${artistId}`)
    if (total > 50) {
      console.warn(`${artist.name} has more than 50 albums`)
    }
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
  const {
    body: {total, items: tracks},
  } = await api.getMySavedTracks({limit: 50})
  if (total > 50) {
    console.warn('You have more than 50 albums')
  }

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
    const {
      body: {total, items: artistRealAlbums},
    } = await cached(() => api.getArtistAlbums(artistId, {limit: 50}), `artist/${artistId}`)
    if (total > 50) {
      console.warn(`https://open.spotify.com/artist/${artistId} has more than 50 albums`)
    }

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
