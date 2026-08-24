#!/usr/bin/env bash
# Normalize raw clips into CESP-ready mp3s.
#
# Drop whatever you grab (rips, soundboard downloads, wav, mp4, ogg) into
# raw/ named after the clip slug used in tools/build_pack.py — e.g.
# raw/my-cabbages.wav — then run:
#
#     tools/normalize.sh
#
# Every file lands in sounds/<slug>.mp3 as mono 44.1 kHz 128 kbps, loudness
# matched to -16 LUFS so no single ping is twice as loud as the rest, with
# leading and trailing silence trimmed.
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p sounds

shopt -s nullglob
raw_files=(raw/*)
if [ ${#raw_files[@]} -eq 0 ]; then
  echo "Nothing in raw/ — drop source clips there first (named <slug>.<ext>)."
  exit 0
fi

for src in "${raw_files[@]}"; do
  slug="$(basename "${src%.*}")"
  out="sounds/${slug}.mp3"
  ffmpeg -hide_banner -loglevel error -y -i "$src" \
    -ac 1 -ar 44100 -b:a 128k \
    -af "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,\
areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse,\
loudnorm=I=-16:TP=-1.5:LRA=11" \
    "$out"
  printf '%-40s %6s KB\n' "$out" "$(( $(stat -c%s "$out" 2>/dev/null || stat -f%z "$out") / 1000 ))"
done

echo
python3 tools/build_pack.py --check
