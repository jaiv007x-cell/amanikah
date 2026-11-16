#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
SOURCE_DIR="site/images/film"
OUT="$SOURCE_DIR/amanikah-story-30s.mp4"
test -s "$SOURCE_DIR/amanikah-actor.mp4"
test -s "$SOURCE_DIR/amanikah-couple.mp4"
test -s "$SOURCE_DIR/amanikah-poster.webp"
# Exactly three ten-second segments. Freeze the final frame of each live-action-style
# AI clip rather than slowing or restarting the actor in an unnatural loop.
ffmpeg -hide_banner -loglevel error -y \
  -i "$SOURCE_DIR/amanikah-actor.mp4" \
  -i "$SOURCE_DIR/amanikah-couple.mp4" \
  -loop 1 -framerate 24 -t 10 -i "$SOURCE_DIR/amanikah-poster.webp" \
  -filter_complex "[0:v]fps=24,scale=960:540:force_original_aspect_ratio=decrease,pad=960:540:(ow-iw)/2:(oh-ih)/2,setsar=1,tpad=stop_mode=clone:stop_duration=10,trim=duration=10,setpts=PTS-STARTPTS[v0];[1:v]fps=24,scale=960:540:force_original_aspect_ratio=decrease,pad=960:540:(ow-iw)/2:(oh-ih)/2,setsar=1,tpad=stop_mode=clone:stop_duration=10,trim=duration=10,setpts=PTS-STARTPTS[v1];[2:v]fps=24,scale=960:540:force_original_aspect_ratio=decrease,pad=960:540:(ow-iw)/2:(oh-ih)/2,setsar=1,trim=duration=10,setpts=PTS-STARTPTS[v2];[v0][v1][v2]concat=n=3:v=1:a=0,format=yuv420p[film]" \
  -map "[film]" -an -c:v libx264 -preset veryfast -crf 29 -pix_fmt yuv420p \
  -movflags +faststart -r 24 -t 30 "$OUT"
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 "$OUT"
