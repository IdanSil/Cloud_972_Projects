#!/usr/bin/env python3
"""Build openpeon.json for the Avatar: The Last Airbender peon-ping pack.

The CLIPS table below is the single source of truth. Regenerate the manifest
with:

    python3 tools/build_pack.py

Check which clips have actually been cut, and whether they fit the CESP
size limits:

    python3 tools/build_pack.py --check
"""

import argparse
import json
import sys
from pathlib import Path

PACK_DIR = Path(__file__).resolve().parent.parent

# CESP v1.0 limits.
MAX_FILE_BYTES = 1_000_000
MAX_PACK_BYTES = 50_000_000

# file, category, label, speaker, episode, target seconds, verified
# verified=True means the wording/episode was confirmed against a source;
# False means confirm it while cutting the clip.
CLIPS = [
    # -- session.start ---------------------------------------------------
    ("water-earth-fire-air", "session.start", "Water. Earth. Fire. Air.",
     "Katara", "Opening narration", 3.0, True),
    ("yip-yip", "session.start", "Yip yip!",
     "Aang", "Recurring", 1.0, True),
    ("flameo-hotman", "session.start", "Flameo, hotman!",
     "Aang", "S3E2 The Headband", 1.5, True),
    ("im-the-avatar-deal-with-it", "session.start", "I'm the Avatar! You gotta deal with it!",
     "Aang (Ember Island actress)", "S3E17 The Ember Island Players", 2.5, False),
    ("appa-groan", "session.start", "*Appa groans*",
     "Appa", "Recurring", 1.0, False),

    # -- task.acknowledge ------------------------------------------------
    ("greatest-earthbender", "task.acknowledge", "I am the greatest earthbender in the world!",
     "Toph", "S2E8 The Chase", 2.0, False),
    ("rock-alanche", "task.acknowledge", "...ready to bury you in a rock-alanche!",
     "The Boulder", "S2E6 The Blind Bandit", 2.5, True),
    ("capture-the-avatar-honor", "task.acknowledge", "I must capture the Avatar to restore my honor.",
     "Zuko", "Book 1", 2.5, False),
    ("face-the-music", "task.acknowledge", "Time to face the music.",
     "Aang", "Recurring", 1.5, False),
    ("air-whoosh", "task.acknowledge", "*airbending whoosh*",
     "SFX", "Recurring", 0.5, False),
    ("fire-whoosh", "task.acknowledge", "*firebending whoosh*",
     "SFX", "Recurring", 0.5, False),

    # -- task.complete ---------------------------------------------------
    ("boomerang-comes-back", "task.complete", "Boomerang! You do always come back!",
     "Sokka", "Book 3", 2.5, False),
    ("so-proud-of-you", "task.complete", "I am so proud of you.",
     "Iroh", "S3E19 Sozin's Comet: The Old Masters", 2.0, False),
    ("secret-ingredient-is-love", "task.complete", "The secret ingredient is love.",
     "Iroh", "Book 2", 2.0, False),
    ("bumi-cackle", "task.complete", "*Bumi cackles*",
     "Bumi", "S1E5 The King of Omashu", 2.0, False),
    ("tsungi-horn", "task.complete", "*tsungi horn sting*",
     "Score", "Recurring", 2.0, False),

    # -- task.error ------------------------------------------------------
    ("my-cabbages", "task.error", "MY CABBAGES!",
     "Cabbage merchant", "S1E5 The King of Omashu (first)", 2.0, True),
    ("thats-rough-buddy", "task.error", "That's rough, buddy.",
     "Zuko", "S3E14 The Boiling Rock, Part 1", 1.5, True),
    ("girlfriend-turned-into-the-moon", "task.error", "My first girlfriend turned into the moon.",
     "Sokka", "S3E14 The Boiling Rock, Part 1", 3.0, True),
    ("your-other-self", "task.error",
     "Only then will your true self reveal itself!",
     "Dream-Iroh", "S3E9 Nightmares and Daydreams", 2.5, False),
    ("momo-shriek", "task.error", "*Momo shrieks*",
     "Momo", "Recurring", 1.0, False),
    ("appa-roar", "task.error", "*Appa roars*",
     "Appa", "Recurring", 1.5, False),

    # -- input.required --------------------------------------------------
    ("who-are-you-what-do-you-want", "input.required", "Who are you, and what do you want?",
     "Iroh", "S2E9 Bitter Work", 3.0, False),
    ("no-war-in-ba-sing-se", "input.required", "There is no war in Ba Sing Se.",
     "Joo Dee", "S2E14 City of Walls and Secrets", 2.5, False),
    ("hello-zuko-here", "input.required", "Hello, Zuko here.",
     "Zuko", "S3E12 The Western Air Temple", 2.0, False),
    ("would-you-like-a-cup-of-tea", "input.required", "Would you like a cup of tea?",
     "Iroh", "Recurring", 2.0, False),
    ("im-blind-here", "input.required", "Hey, I'm blind here!",
     "Toph", "Recurring", 1.5, False),
    ("lettuce-leaf", "input.required", "Lettuce leaf?",
     "Bumi", "S1E5 The King of Omashu", 1.5, False),

    # -- resource.limit --------------------------------------------------
    ("i-think-youve-had-enough", "resource.limit", "Okay, I think you've had enough.",
     "Katara", "S2E11 The Desert", 2.0, True),
    ("its-the-quenchiest", "resource.limit", "It's the quenchiest!",
     "Sokka", "S2E11 The Desert", 1.5, True),
    ("running-out-of-water", "resource.limit", "We're running out of water.",
     "Katara", "S2E11 The Desert", 2.0, False),
    ("before-the-comet-arrives", "resource.limit",
     "You must defeat the Fire Lord before the comet arrives.",
     "Avatar Roku", "Book 1/3", 3.0, False),

    # -- user.spam -------------------------------------------------------
    ("dunderheads", "user.spam", "And don't you two dunderheads ever forget it!",
     "Toph", "S2E8 The Chase", 2.5, False),
    ("melon-lord", "user.spam", "I am the Melon Lord!",
     "Toph", "S3E18 Sozin's Comet: The Phoenix King", 2.0, False),
    ("okay-i-get-it", "user.spam", "Okay, okay, I get it!",
     "Sokka", "Recurring", 1.5, False),

    # -- session.end -----------------------------------------------------
    ("leaves-from-the-vine", "session.end", "Leaves from the vine, falling so slow...",
     "Iroh", "S2E15 Tales of Ba Sing Se", 4.0, False),
    ("momo-chirp", "session.end", "*Momo chirps*",
     "Momo", "Recurring", 1.0, False),

    # -- task.progress ---------------------------------------------------
    ("appa-flight", "task.progress", "*Appa flight whoosh*",
     "SFX", "Recurring", 0.5, False),
    ("water-whoosh", "task.progress", "*waterbending whoosh*",
     "SFX", "Recurring", 0.5, False),
    ("earth-rumble", "task.progress", "*earthbending rumble*",
     "SFX", "Recurring", 0.7, False),
]

# Clips that earn a second home. peon-ping draws at random per event, so a
# line that genuinely fits two moments should sit in both pools.
ALSO_IN = {
    "flameo-hotman": ["session.end"],      # means hello, goodbye *or* great
    "hello-zuko-here": ["session.start"],  # the awkward arrival
    "momo-chirp": ["task.progress"],
}

CATEGORY_ORDER = [
    "session.start",
    "task.acknowledge",
    "task.complete",
    "task.error",
    "input.required",
    "resource.limit",
    "user.spam",
    "session.end",
    "task.progress",
]


def build_categories():
    categories = {name: {"sounds": []} for name in CATEGORY_ORDER}
    for slug, category, label, _speaker, _episode, _secs, _verified in CLIPS:
        entry = {"file": f"sounds/{slug}.mp3", "label": label}
        categories[category]["sounds"].append(entry)
        for extra in ALSO_IN.get(slug, []):
            categories[extra]["sounds"].append(dict(entry))
    return categories


def build_manifest():
    return {
        "cesp_version": "1.0",
        "name": "atla",
        "display_name": "Avatar: The Last Airbender",
        "version": "0.1.0",
        "description": "Catchphrases and iconic moments from Avatar: The Last Airbender.",
        "author": {"name": "Idan Silbinger", "github": "IdanSil"},
        "license": "CC-BY-NC-4.0",
        "language": "en",
        "homepage": "https://github.com/IdanSil/Cloud_972_Projects",
        "tags": ["avatar", "atla", "cartoon", "nickelodeon", "aang", "iroh"],
        "categories": build_categories(),
    }


def check():
    """Report which clips are still missing and flag CESP limit violations."""
    missing, present, oversized, total = [], [], [], 0
    for slug, category, _label, _speaker, _episode, _secs, _verified in CLIPS:
        path = PACK_DIR / "sounds" / f"{slug}.mp3"
        if not path.exists():
            missing.append((category, slug))
            continue
        size = path.stat().st_size
        total += size
        present.append(slug)
        if size > MAX_FILE_BYTES:
            oversized.append((slug, size))

    print(f"{len(present)}/{len(CLIPS)} clips cut, {total / 1_000_000:.1f} MB total")

    if oversized:
        print(f"\nOver the {MAX_FILE_BYTES // 1000} KB per-file limit:")
        for slug, size in oversized:
            print(f"  {slug}.mp3 ({size / 1_000_000:.2f} MB)")
    if total > MAX_PACK_BYTES:
        print(f"\nPack exceeds the {MAX_PACK_BYTES // 1_000_000} MB limit.")
    if missing:
        print("\nStill to cut:")
        for category in CATEGORY_ORDER:
            slugs = [s for c, s in missing if c == category]
            if slugs:
                print(f"  {category}: {', '.join(slugs)}")

    # Non-verbal clips have no wording to confirm, so leave them out of this.
    unverified = [c[0] for c in CLIPS if not c[6] and not c[2].startswith("*")]
    if unverified:
        print(f"\n{len(unverified)} clips have unconfirmed wording/episode "
              f"— confirm while cutting: {', '.join(unverified)}")

    return 1 if (missing or oversized or total > MAX_PACK_BYTES) else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true",
                        help="report missing clips and CESP limit violations")
    args = parser.parse_args()

    if args.check:
        return check()

    manifest = build_manifest()
    out = PACK_DIR / "openpeon.json"
    out.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")

    counts = {name: len(body["sounds"]) for name, body in manifest["categories"].items()}
    print(f"Wrote {out.relative_to(PACK_DIR)} — {sum(counts.values())} entries "
          f"across {len(counts)} categories")
    for name in CATEGORY_ORDER:
        print(f"  {name:<20} {counts[name]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
