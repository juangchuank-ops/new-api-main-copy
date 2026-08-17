# Classic Homepage Public Banners

## Summary

The classic frontend homepage now displays public banners configured by administrators. This brings the classic console in line with the existing public banner API without changing banner management or access-control behavior.

## What Changed

- Added `PublicBanners` to the classic frontend.
- Added the component to the top of the classic homepage.
- The homepage requests `GET /api/banners` without authentication after it loads.
- When the API returns no visible banners, no banner area is rendered.
- A failed banner request is ignored so it cannot prevent the homepage from rendering.

## Which Banners Appear

The backend returns only banners that are publicly visible. A banner must meet all of the following conditions:

- It is enabled.
- Its configured start date has arrived, if a start date is set.
- Its configured end date has not passed, if an end date is set.
- Its content, type, and optional link pass backend validation.

Banners are ordered by descending sort order, then by descending publish date.

## Visual Types

Classic homepage banners use the existing Semi Design banner component. The following banner types are mapped to its supported styles:

| Banner type | Display style |
| --- | --- |
| `default` | information |
| `ongoing` | information |
| `success` | success |
| `warning` | warning |
| `error` | danger |

Unknown types fall back to the information style.

## Content and Link Safety

- Banner content is rendered as text. It is not parsed as HTML, so administrator-provided markup cannot execute in visitors' browsers.
- An optional banner link is rendered only when it uses the `http:` or `https:` scheme.
- Valid links open in a separate tab with `noopener noreferrer` protection.

## Deployment

The classic frontend build is embedded into the Go executable. To deploy this change from source, rebuild the classic frontend and then rebuild or redeploy the Go service:

```bash
cd web/classic
bun run build
cd ../..
go build -o new-api .
```

For Docker deployments, rebuild the image. The project Dockerfile builds the classic frontend and embeds its generated static assets automatically.

## Verification

1. Create or enable a banner in the administrator banner management page.
2. Open the classic homepage and refresh the page.
3. Confirm that the banner content and its configured style appear at the top of the homepage.
4. For a banner with a valid HTTP(S) link, confirm that selecting the content opens the destination in a new tab.
5. Disable the banner or use a date outside its visibility window, then refresh and confirm it no longer appears.