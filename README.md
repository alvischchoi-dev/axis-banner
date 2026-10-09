# AXIS banner

Interactive magnetic light field with the approved AXIS color treatment and typography.

The scene fades in first, followed by the masked headline and then the subtitle. Cursor and placed lights breathe over 2.4 seconds. Slow cursor movement attracts incoming light; clicking leaves a light that drifts toward the fixed center.

## Preview

Serve this directory over HTTP, then open `index.html`. Opening the file directly does not support browser modules.

```sh
python3 -m http.server 8000
```

The Cursor lights link opens the four color choices. The tuning controls save locally in the browser. Space pauses, R restarts, and H toggles the controls.

## GitHub Pages

Publish the `main` branch from `/ (root)` in the repository's Pages settings. All application links and assets use relative paths, including when the site is hosted under a repository subpath.
