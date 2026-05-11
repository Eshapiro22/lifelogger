# Dunkapedia

A static, GitHub Pages-friendly rebuild of Dunkapedia: a curated dunk catalog with filters, modal video playback, and optional live YouTube search.

## Features

- Curated dunk archive that works with no build step
- Filter by player, team, year, tag, or free-text search
- Embedded YouTube playback in a modal
- Optional YouTube Data API search using a browser-stored API key

## Run Locally

Open `index.html` directly in a browser, or serve the folder with any static file server.

## YouTube API Setup

Live search is optional. Use the `API Key` button in the site header to store a YouTube Data API key in `localStorage`.

## Deployment

GitHub Pages is configured to deploy this static site from the `devin/1778245885-personal-landing-page` branch.

## Project Files

- `index.html` — App structure
- `style.css` — Visual design and layout
- `app.js` — Catalog data, filters, modal playback, and YouTube search
- `favicon.svg` — Site icon
