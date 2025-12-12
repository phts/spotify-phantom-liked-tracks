# Spotify phantom liked tracks and albums

## Background

There is [an old known issue](https://community.spotify.com/t5/Live-Ideas/All-Platforms-Consolidate-duplicates/idi-p/4829023) with duplicated tracks and albums on Spotify.

So if you liked a track and its album was suppressed by new version, old album entry won't be shown on artist's page, but still exist in the database. If you open album from artist's page, you will find out that track you liked is not marked as favorite anymore, because physical ID of the track is changed, but still exists on Liked tracks page.

This app will find such suspicious duplicates to allow you fixing them manually.

## Usage

1. [Create a new app](https://developer.spotify.com/documentation/web-api/concepts/apps) in [Spotify for Developers](https://developer.spotify.com/dashboard)
   - Any name and description
   - Redirect URI: `http://127.0.0.1:9876`

2. Clone the repo and run `npm install`
3. Create [`app/settings.json`](./app/settings.json.example) file with `Client ID` and `Client secret` from the step above
4. Run web application:

   ```sh
   npm start
   ```

   It will ask for authentication. And then opens the home page.

5. Click item to analyze
6. Wait a bit. Report will be generated as a web pge. Progress is shown in the terminal.

## How it works

`not found` below means album/track was suppressed by other entry, e.g. remaster, but still is added to library (as favorite or into playlist), but not listed under the artist and cannot be found by the search.

The app will try to find similar albums/tracks which could replace the old one.

### Favorite albums

For each favorite album:

1.  Retrieve album's artist
2.  Get all artist's actual albums (which shown in Spotify UI)
3.  Search for album ID which has favorite album entry inside the actual artist's albums. If `not found` then print warning and go to the next album.

### Playlist tracks

For each playlist (or favorite) track:

1.  Retrieve tracks's artist
2.  Get all artist's actual albums (which shown in Spotify UI)
3.  Get the album of the analyzed track
4.  Search for album ID referenced by analyzed track inside the artist's actual albums. If `not found` then print warning and go to the next track.
5.  Search for track ID which has analyzed track inside the album. If `not found` then print warning and go to the next track.
