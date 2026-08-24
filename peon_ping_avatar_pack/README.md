# Avatar: The Last Airbender — peon-ping sound pack

A [peon-ping](https://github.com/PeonPing/peon-ping) sound pack built to the
[CESP v1.0](https://github.com/PeonPing/openpeon) standard. 40 clips across all
nine event categories — peon-ping draws one at random from the matching pool on
every agent event, so each category carries a deep enough bench that you don't
hear the same line twice in a row.

**Status:** manifest complete, audio not yet cut. See [Cutting the clips](#cutting-the-clips).

## Layout

```
peon_ping_avatar_pack/
  openpeon.json          generated — do not hand-edit
  sounds/                the clips (40 × mp3)
  raw/                   gitignored drop zone for unprocessed source audio
  tools/
    build_pack.py        clip table (source of truth) → openpeon.json
    normalize.sh         raw/ → sounds/, loudness-matched
  SOUND_CANDIDATES.md    the research: every line, speaker, episode, trim note
```

## The pools

| Category | Clips | Anchor line |
|---|---|---|
| `session.start` | 6 | "Water. Earth. Fire. Air." |
| `task.acknowledge` | 6 | "...ready to bury you in a rock-alanche!" |
| `task.complete` | 5 | "Boomerang! You do always come back!" |
| `task.error` | 6 | **"MY CABBAGES!"** |
| `input.required` | 6 | "Who are you, and what do you want?" |
| `resource.limit` | 4 | "Okay, I think you've had enough." |
| `user.spam` | 3 | "And don't you two dunderheads ever forget it!" |
| `session.end` | 3 | "Flameo, hotman!" |
| `task.progress` | 4 | *(non-verbal only — bending whooshes)* |

Three clips sit in two pools each, because they genuinely fit both moments:
`flameo-hotman` (in-universe it means hello, goodbye *or* great),
`hello-zuko-here`, and `momo-chirp`. That's 43 manifest entries over 40 files.

`task.progress` is deliberately wordless — a voice line every few seconds
during a long tool call gets old fast.

## Cutting the clips

1. Get source audio for each slug listed by `python3 tools/build_pack.py --check`.
   Best quality comes from your own episode files:
   `ffmpeg -ss <start> -t <len> -i ep.mkv raw/<slug>.wav`.
   Soundboards (myinstants, 101soundboards, voicy) cover most of these lines
   too, at variable quality.
2. Drop everything in `raw/` named `<slug>.<ext>`.
3. Run `tools/normalize.sh` — converts to mono 44.1 kHz 128 kbps mp3, trims
   silence at both ends, and matches loudness to -16 LUFS so no ping is twice
   as loud as the others. Well inside the 1 MB per-file CESP cap.
4. `python3 tools/build_pack.py --check` until it comes back clean.

20 clips carry unconfirmed wording or episode attribution — `--check` lists
them. Confirm as you cut; the others were verified during research.

## Editing the pack

`openpeon.json` is generated. Add, remove or recategorize clips by editing the
`CLIPS` table in `tools/build_pack.py`, then run `python3 tools/build_pack.py`.

## Licensing

Clips cut from the show are Nickelodeon's. Using this pack locally is ordinary
personal use; publishing it to the public peon-ping registry would be
redistributing copyrighted audio. If you want a publishable version,
peon-ping's `peon create` flow renders the same lines through ElevenLabs
instead.
