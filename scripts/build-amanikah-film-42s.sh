#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
SRC="site/images/film"
OUT="$SRC/amanikah-story-42s.mp4"
for file in amanikah-actor.mp4 amanikah-couple.mp4 amanikah-poster.webp clean-couple-poster.webp; do
  test -s "$SRC/$file" || { echo "Missing source: $file" >&2; exit 2; }
done
command -v ffmpeg >/dev/null
command -v ffprobe >/dev/null

# 42-second calm montage. Video motion is natural 1.0x, no sped-up loops.
# Original clips are extended by holding their last frame; stills gently push in.
# 12s actor + 10s portrait + 12s couple + 11s portrait
# minus three 1s crossfades = 42 seconds.
ffmpeg -hide_banner -loglevel error -y \
  -i "$SRC/amanikah-actor.mp4" \
  -loop 1 -framerate 1 -t 1 -i "$SRC/amanikah-poster.webp" \
  -i "$SRC/amanikah-couple.mp4" \
  -loop 1 -framerate 1 -t 1 -i "$SRC/clean-couple-poster.webp" \
  -filter_complex "
    [0:v]fps=24,scale=960:540:force_original_aspect_ratio=decrease,
         pad=960:540:(ow-iw)/2:(oh-ih)/2,setsar=1,
         tpad=stop_mode=clone:stop_duration=12,trim=duration=12,
         settb=AVTB,setpts=PTS-STARTPTS,format=yuv420p[v0];
    [1:v]scale=960:540:force_original_aspect_ratio=increase,
         crop=960:540,setsar=1,
         zoompan=z='min(zoom+0.00016,1.035)':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=240:s=960x540:fps=24,
         trim=duration=10,settb=AVTB,setpts=PTS-STARTPTS,format=yuv420p[v1];
    [2:v]fps=24,scale=960:540:force_original_aspect_ratio=decrease,
         pad=960:540:(ow-iw)/2:(oh-ih)/2,setsar=1,
         tpad=stop_mode=clone:stop_duration=12,trim=duration=12,
         settb=AVTB,setpts=PTS-STARTPTS,format=yuv420p[v2];
    [3:v]scale=960:540:force_original_aspect_ratio=increase,
         crop=960:540,setsar=1,
         zoompan=z='min(zoom+0.00016,1.035)':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=264:s=960x540:fps=24,
         trim=duration=11,settb=AVTB,setpts=PTS-STARTPTS,format=yuv420p[v3];
    [v0][v1]xfade=transition=fade:duration=1:offset=11[x01];
    [x01][v2]xfade=transition=fade:duration=1:offset=20[x012];
    [x012][v3]xfade=transition=fade:duration=1:offset=31,
         format=yuv420p[film]
  " -map "[film]" -an -c:v libx264 -preset veryfast -crf 28 \
  -movflags +faststart -pix_fmt yuv420p -r 24 -t 42 "$OUT"
duration="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$OUT")"
python3 -c "import sys; d=float(sys.argv[1]); assert 41.8<=d<=42.2, f'Unexpected duration {d}'" "$duration"
echo "Created illustrative film: $duration seconds"
ffprobe -v error -show_entries format=duration,size:stream=width,height,r_frame_rate -of default=noprint_wrappers=1 "$OUT"
