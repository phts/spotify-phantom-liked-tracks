# Spotify phantom liked tracks and albums

## Background

There is [an old known issue](https://community.spotify.com/t5/Live-Ideas/All-Platforms-Consolidate-duplicates/idi-p/4829023) with duplicated tracks and albums on Spotify.

So if you liked a track and its album was suppressed by new version, old album entry won't be shown on artist's page, but still exist in the database. If you open album from artist's page, you will find out that track you liked is not marked as favorite anymore, because physical ID of the track is changed, but still exists on Liked tracks page.

This app will find such suspicious duplicates to allow you fixing them manually.

## Usage

1. [Create a new app](https://developer.spotify.com/documentation/web-api/concepts/apps) in Spotify for Developers
2. Clone the repo and run `npm install`
3. Create `settings.json` file with `Client ID` and `Client secret` from the created app above
4. Run:

   ```sh
   npm start
   ```
