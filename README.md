# How Long?

Minimal static countdown page for "how long until..." links.

## Stack

- Plain HTML, CSS, and JavaScript
- No build step
- No dependencies

## Run

Open `index.html` directly in a browser, or serve the directory with any static file server.

## URL Parameters

- `target=YYYY-MM-DDTHH:mm`
- `zone=Area/City`
- `label=Optional event name`

Example:

`?target=2026-03-13T17:00&zone=America%2FNew_York&label=Launch`

The target is always interpreted in the selected IANA timezone. Viewers then see the same moment translated into their own local timezone.

## Deploy

Publish the repository root as a static site. GitHub Pages works without additional configuration or build tooling.
