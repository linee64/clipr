# Template tracks

Drop any `.mp3` file into this folder and it automatically becomes a selectable
built-in track in the create flow (the "Background music" step), so creators
without their own music can pick one.

- **No config needed.** The filename becomes the display name
  (`midnight_drive.mp3` → "Midnight Drive") and the track id (slugified).
- The track is lazily copied into the storage bucket the renderer reads from
  (`audio/<id>.mp3`), so render works the same as an uploaded track.

## Optional: custom name / vibe

Add a `tracks.json` next to the files to override metadata per track. The key is
the slugified filename (lowercase, non-alphanumerics → `-`):

```json
{
  "midnight-drive": { "name": "Midnight Drive", "vibe": "dark ambient" },
  "bliss-slowed-klsr": { "name": "Bliss", "vibe": "atmospheric" }
}
```

`vibe` defaults to `"atmospheric"` when not set.
