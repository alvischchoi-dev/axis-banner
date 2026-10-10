# Axis banner

Responsive magnetic light field with the approved Axis color treatment and typography.

The scene fades in first, followed by the masked headline and then the subtitle. Cursor and placed lights breathe over 2.4 seconds. Slow cursor movement attracts incoming light; clicking leaves a light that drifts toward the fixed center.

## Preview

Serve this directory over HTTP, then open `index.html`. Opening the file directly does not support browser modules.

```sh
python3 -m http.server 8000
```

The published page presents the artwork without the development control strip or a controls toggle. Hover and click interactions remain active. Space pauses and R replays the entrance. The four cursor color choices are available separately in `cursor-lights.html`.

The hero fills the dynamic viewport. Measured 12-column layouts split the heading around the fixed star; portrait and narrow layouts use four centered title lines. Portrait supporting copy uses two-thirds of the padded content width, capped at 560px, and is centered between the lower title and the bottom guide. Primary taps place lights; swipes and pinch zoom retain browser behavior. Resizing preserves the existing lights and motion clocks. Reduced motion and unavailable scripts/canvas have complete static presentations.

The page title is Axis by Alvis Choi. Transparent 64px logo favicons switch immediately between Figma Indigo #1C367C in light appearance and white in dark appearance.

## GitHub Pages

Publish the `main` branch from `/ (root)` in the repository's Pages settings. All application links and assets use relative paths, including when the site is hosted under a repository subpath.
