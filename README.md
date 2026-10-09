# AXIS banner

Interactive magnetic light field with the approved AXIS color treatment and typography.

The scene fades in first, followed by the masked headline and then the subtitle. Cursor and placed lights breathe over 2.4 seconds. Slow cursor movement attracts incoming light; clicking leaves a light that drifts toward the fixed center.

## Preview

Serve this directory over HTTP, then open `index.html`. Opening the file directly does not support browser modules.

```sh
python3 -m http.server 8000
```

The published page presents the artwork without the development control strip or a controls toggle. Hover and click interactions remain active. Space pauses and R replays the entrance. The four cursor color choices are available separately in `cursor-lights.html`.

## GitHub Pages

Publish the `main` branch from `/ (root)` in the repository's Pages settings. All application links and assets use relative paths, including when the site is hosted under a repository subpath.
