# Avatar: The Last Airbender — peon-ping sound pack

Candidate clip list for a CESP v1.0 sound pack (`peon-ping` / `openpeon`).
Every line below is in the pack — peon-ping picks at random from a category's
pool on each event, so a deep bench per category is the point. The shipping
mapping lives in `tools/build_pack.py`; this document is the research behind it
(speaker, episode, trim notes). See `README.md` for how to cut the audio.

## 1. What the pack has to look like

peon-ping packs follow the **CESP v1.0** open standard: a directory with an
`openpeon.json` manifest plus a `sounds/` folder.

```
atla/
  openpeon.json
  sounds/
    my-cabbages.mp3
    yip-yip.mp3
    ...
```

Manifest shape:

```json
{
  "cesp_version": "1.0",
  "name": "atla",
  "display_name": "Avatar: The Last Airbender",
  "version": "1.0.0",
  "categories": {
    "session.start": { "sounds": [{ "file": "sounds/yip-yip.mp3", "label": "Yip yip!" }] }
  }
}
```

Constraints that shape clip selection:

| Rule | Value |
|---|---|
| Formats | WAV, MP3, OGG Vorbis |
| Max per file | 1 MB |
| Max pack total | 50 MB |
| `preview` clip | ≤ 10 s |
| Required fields | `cesp_version`, `name`, `display_name`, `version`, `categories` |
| Recommended fields | `description`, `author`, `license`, `language`, `homepage` |

No duration limit is specified, but the 1 MB cap and the fact that these fire on
every tool event mean **1–3 seconds is the target**; 4 s is the ceiling for the
few lines that need a beat (the Boulder, the cactus juice rant).

### Event categories

Core: `session.start`, `task.acknowledge`, `task.complete`, `task.error`,
`input.required`, `resource.limit`.
Extended (optional): `user.spam`, `session.end`, `task.progress`.

`input.required` is the one that matters most — it's the "Claude is blocked on
you" ping that the whole tool exists for. It deserves the deepest bench so it
doesn't get stale.

---

## 2. Candidate clips

Legend: **✔** = wording/episode confirmed during research · **~** = from memory,
confirm the exact wording and episode when cutting the clip.

### session.start — a session opens

| Line | Speaker | Episode | Est. | Note |
|---|---|---|---|---|
| "Water. Earth. Fire. Air." | Katara | Opening narration (every ep) | ~3 s | ✔ The single most recognizable 3 seconds in the show. Default pick. |
| "Yip yip!" | Aang | Recurring | ~1 s | ✔ Short, punchy, literally "let's go." Strong default. |
| "Flameo, hotman!" | Aang | S3E2 *The Headband* | ~1.5 s | ✔ In-universe it means hello, goodbye *or* great — reusable in `session.end` too. |
| "Hello, Zuko here." | Zuko | S3E12 *The Western Air Temple* | ~2 s | ~ Peak awkward-arrival energy. |
| "I'm the Avatar! You gotta deal with it!" | Aang (Ember Island actress) | S3E17 *The Ember Island Players* | ~2.5 s | ~ Meme-tier. |
| Appa's groan / Momo chirp | — | Recurring | ~1 s | Non-verbal alternative for people who don't want a voice line on every start. |

### task.acknowledge — work accepted, starting

| Line | Speaker | Episode | Est. | Note |
|---|---|---|---|---|
| "I am the greatest earthbender in the world!" | Toph | S2E8 *The Chase* | ~2 s | ~ Trim before the "dunderheads" tail (save that for `user.spam`). |
| "The Boulder's over his conflicted feelings, and now he's ready to bury you in a rock-alanche!" | The Boulder | S2E6 *The Blind Bandit* | ~5 s | ✔ Too long as-is — cut to "…ready to bury you in a rock-alanche!" |
| "I must capture the Avatar to restore my honor." | Zuko | Book 1 | ~2.5 s | ~ Wording varies across episodes; pick the cleanest read. |
| "Time to face the music." | Aang | Recurring | ~1.5 s | ~ |
| Airbending whoosh / fire whoosh | — | Recurring SFX | ~0.5 s | Cheap, non-fatiguing acknowledge tick. |

### task.complete — work finished

| Line | Speaker | Episode | Est. | Note |
|---|---|---|---|---|
| "Boomerang! You do always come back!" | Sokka | Book 3 | ~2.5 s | ~ Episode needs confirming. Best "it worked" line in the show. |
| "I am so proud of you." | Iroh | S3E19 *Sozin's Comet: The Old Masters* | ~2 s | ~ Exact wording needs confirming; the sentiment is right for a green build. |
| Bumi's cackle | Bumi | S1E5 *The King of Omashu* | ~2 s | ~ Works as a "done, and it was ridiculous" variant. |
| "The secret ingredient is love." | Iroh | Book 2 (tea) | ~2 s | ~ |
| Tsungi horn / victory sting | — | Score | ~2 s | Instrumental option. |

### task.error — something failed

| Line | Speaker | Episode | Est. | Note |
|---|---|---|---|---|
| **"MY CABBAGES!"** | Cabbage merchant | First: S1E5 *The King of Omashu*, then recurring | ~2 s | ✔ The headline sound of this pack. Non-negotiable. |
| "That's rough, buddy." | Zuko | S3E14 *The Boiling Rock, Part 1* | ~1.5 s | ✔ Perfect deadpan for a failed test run. |
| "My first girlfriend turned into the moon." | Sokka | S3E14 *The Boiling Rock, Part 1* | ~3 s | ✔ The setup line — pairs with the above as a two-clip gag. |
| "You must look within yourself to save yourself from your other self! Only then will your true self reveal itself!" | Dream-Iroh | S3E9 *Nightmares and Daydreams* | ~6 s | ~ Way too long — cut to the last clause. Ideal for an incomprehensible stack trace. |
| Momo's shriek / Appa's roar | — | Recurring | ~1 s | Non-verbal error. |

### input.required — blocked, waiting on you *(deepest bench)*

| Line | Speaker | Episode | Est. | Note |
|---|---|---|---|---|
| "Who are you, and what do you want?" | Iroh | S2E9 *Bitter Work* | ~3 s | ~ Trim off the "It is time to look inward…" preamble. Literally the permission prompt. |
| "There is no war in Ba Sing Se." | Joo Dee | S2E14 *City of Walls and Secrets* | ~2.5 s | ~ Unsettlingly perfect for a denied tool call. |
| "Hello, Zuko here." | Zuko | S3E12 *The Western Air Temple* | ~2 s | ~ Use here if not used at session start. |
| "Would you like a cup of tea?" | Iroh | Recurring | ~2 s | ~ Gentle "come back to the terminal." |
| "Hey, I'm blind here!" | Toph | Recurring | ~1.5 s | ~ Wording varies; several usable takes. |
| "Lettuce leaf?" | Bumi | S1E5 *The King of Omashu* | ~1.5 s | ~ Absurdist variant. |

### resource.limit — rate limit / quota / token exhaustion

| Line | Speaker | Episode | Est. | Note |
|---|---|---|---|---|
| **"Okay, I think you've had enough."** | Katara | S2E11 *The Desert* | ~2 s | ✔ Best rate-limit line in fiction. Top pick. |
| "It's the quenchiest!" | Sokka | S2E11 *The Desert* | ~1.5 s | ✔ Full line is "Drink cactus juice. It'll quench ya. Nothing is quenchier. It's the quenchiest!" — cut the tail, or keep ~4 s for the full rant. |
| "We're running out of water." | Katara | S2E11 *The Desert* | ~2 s | ~ |
| "You must defeat the Fire Lord before the comet arrives." | Roku | Book 1/3 | ~3 s | ~ Deadline energy for a quota warning. |

### user.spam — you're mashing the keyboard

| Line | Speaker | Episode | Est. | Note |
|---|---|---|---|---|
| "And don't you two dunderheads ever forget it!" | Toph | S2E8 *The Chase* | ~2.5 s | ~ The tail of the greatest-earthbender line. |
| "I am the Melon Lord!" | Toph | S3E18 *Sozin's Comet: The Phoenix King* | ~2 s | ~ |
| "Okay, okay, I get it!" | Sokka | Recurring | ~1.5 s | ~ |

### session.end — session closes

| Line | Speaker | Episode | Est. | Note |
|---|---|---|---|---|
| "Leaves from the vine, falling so slow…" | Iroh | S2E15 *Tales of Ba Sing Se* | ~4 s | ~ Gorgeous, but genuinely a gut-punch on every quit — ship it as opt-in, not default. |
| "Flameo, hotman!" | Aang | S3E2 *The Headband* | ~1.5 s | ✔ Doubles as goodbye. Safer default. |
| Momo chirp | — | Recurring | ~1 s | |

### task.progress — long task still running

Keep these non-verbal; a voice line every few seconds is unbearable.

- Appa flight whoosh (~0.5 s)
- Momo chirp (~0.7 s)
- Bending whoosh — air/fire/water (~0.5 s each)

---

## 3. Where to actually get the audio

**This session can't fetch any of it.** The remote environment's network policy
returns 403 on `myinstants.com`, `101soundboards.com`, `voicy.network`,
`soundboard.com`, `avatar.fandom.com`, `youtube.com` and `archive.org`.
Acquisition has to happen locally, or in a session with a wider egress policy.

Three routes, best first:

1. **Cut from your own copies of the episodes.** Cleanest audio, exact timing,
   and no reliance on someone else's re-encode. `ffmpeg -ss <start> -t <len> -i
   ep.mkv -ac 1 -ar 44100 -b:a 128k -af loudnorm=I=-16:TP=-1.5:LRA=11 out.mp3`
   keeps every clip well under the 1 MB cap and levels them against each other
   so no single ping is twice as loud as the rest.
2. **Soundboards** — myinstants, 101soundboards, voicy, soundboard.com. One-click
   MP3s, most of the lines above already exist there ("MY CABBAGES!" is
   confirmed present on myinstants). Downside: inconsistent loudness and
   bitrate, so still run everything through `loudnorm`.
3. **Synthesize the lines** via peon-ping's own `peon create` flow, which drafts
   all seven core categories and renders them through ElevenLabs. Avoids show
   audio entirely — but ATLA voice performances *are* the joke here, so this is
   the fallback, not the plan.

One flag worth stating once: clips cut from the show are Nickelodeon's. Keeping
the pack local, or in a private repo, is ordinary personal use. Registering it
in the public peon-ping registry is redistribution of copyrighted audio — that's
your call to make, and route 3 is the clean way around it if you'd rather not.

## 4. Next steps

1. ~~Pick the final line-up.~~ All 40 clips are in — see `openpeon.json`.
2. Cut and normalize the clips (`tools/normalize.sh`).
3. ~~Write `openpeon.json`.~~ Generated by `tools/build_pack.py`.
4. Test locally with `peon` pointed at the pack directory.

## Sources

- [PeonPing/openpeon — CESP v1.0 spec](https://github.com/PeonPing/openpeon)
- [PeonPing/peon-ping](https://github.com/PeonPing/peon-ping)
- [PeonPing/og-packs — the 44 official packs](https://github.com/PeonPing/og-packs)
- [peonping.com](https://www.peonping.com/)
- ["That's Rough, Buddy" — Know Your Meme](https://knowyourmeme.com/memes/thats-rough-buddy)
- ["The Headband" recap — TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/Recap/AvatarTheLastAirbenderTheHeadband)
- ["The Desert" quotes — IMDb](https://www.imdb.com/title/tt0829520/quotes/)
- [MY CABBAGES! — Myinstants](https://www.myinstants.com/en/instant/my-cabbages/)
