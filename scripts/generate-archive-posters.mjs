import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, basename, extname } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const sourceFile = join(root, "src/content/archive.json");
const reportFile = join(root, "scripts/archive-poster-report.json");
const data = JSON.parse(readFileSync(sourceFile, "utf8"));
const results = [];
const failures = [];
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const ffprobe = process.env.FFPROBE_PATH || "ffprobe";

function invoke(exe, args, options = {}) {
  return execFileSync(exe, args, { ...options, maxBuffer: 8 * 1024 * 1024 });
}
try {
  invoke(ffmpeg, ["-version"], { stdio: "ignore" });
  invoke(ffprobe, ["-version"], { stdio: "ignore" });
} catch {
  console.error("ffmpeg and ffprobe are required. Install them before running npm run posters.");
  process.exit(1);
}
function slug(name) {
  return name.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function score(path, time) {
  const frame = invoke(ffmpeg, [
    "-loglevel", "error", "-ss", String(time), "-i", path,
    "-frames:v", "1", "-vf", "scale=64:64:flags=area,format=gray",
    "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1"
  ]);
  if (!frame.length) return null;
  let sum = 0, sumSquares = 0;
  for (const pixel of frame) { sum += pixel; sumSquares += pixel * pixel; }
  const mean = sum / frame.length;
  const deviation = Math.sqrt(Math.max(0, sumSquares / frame.length - mean * mean));
  return { time, brightness: +mean.toFixed(2), contrast: +deviation.toFixed(2) };
}
for (const entry of data) {
  for (const item of entry.items) {
    if (item.type !== "video") continue;
    const source = join(root, "public", item.src.replace(/^\//, ""));
    try {
      if (!existsSync(source)) throw Error("Original video missing: " + item.src);
      const metadata = JSON.parse(invoke(ffprobe, [
        "-v", "error", "-show_entries", "format=duration:stream=width,height",
        "-select_streams", "v:0", "-of", "json", source
      ], { encoding: "utf8" }));
      const stream = metadata.streams?.[0];
      const duration = Number(metadata.format?.duration);
      if (!(duration > 0 && stream?.width > 0 && stream?.height > 0)) throw Error("Video metadata incomplete");
      const firstTimes = [0, .02, .05, .10, .15, .20, .25].map(t => +Math.min(Math.max(.001, duration * t), Math.max(.001, duration - .001)).toFixed(3));
      const fullTimes = [.35, .50, .65, .80, .95].map(t => +Math.min(duration * t, duration - .001).toFixed(3));
      const evaluations = [];
      let chosen;
      for (const t of [...new Set(firstTimes)]) {
        const stats = score(source, t);
        if (!stats) continue;
        evaluations.push(stats);
        if (stats.brightness >= 25.5 && stats.contrast >= 8) { chosen = stats; break; }
      }
      let fallback = false;
      if (!chosen) {
        for (const t of [...new Set(fullTimes)]) {
          const stats = score(source, t);
          if (!stats) continue;
          evaluations.push(stats);
          if (stats.brightness >= 25.5 && stats.contrast >= 8) { chosen = stats; break; }
        }
      }
      if (!chosen) {
        chosen = evaluations.sort((a,b) => b.brightness - a.brightness)[0];
        if (!chosen) throw Error("Cannot decode a video frame");
        fallback = true;
      }
      const name = slug(entry.slug) + "-" + slug(basename(item.src,extname(item.src))) + ".webp";
      const poster = "/img/work/archive/posters/" + name;
      const destination = join(root, "public", poster.slice(1));
      mkdirSync(dirname(destination), { recursive: true });
      invoke(ffmpeg, [
        "-y", "-loglevel", "error", "-ss", String(chosen.time), "-i", source,
        "-frames:v", "1", "-c:v", "libwebp", "-quality", "80", destination
      ]);
      item.poster = poster;
      item.posterTime = chosen.time;
      item.posterWidth = stream.width;
      item.posterHeight = stream.height;
      results.push({title:entry.title,video:item.src,poster,time:chosen.time,brightness:chosen.brightness,contrast:chosen.contrast,wholeVideoFallback:fallback});
      console.log(entry.title + ": " + chosen.time + "s, YAVG " + chosen.brightness + ", contrast " + chosen.contrast);
    } catch (err) {
      failures.push({title:entry.title,video:item.src,error:String(err.message || err)});
      console.error("Poster failed for " + entry.title + ": " + err.message);
    }
  }
}
writeFileSync(sourceFile, JSON.stringify(data, null, 2) + "\n");
writeFileSync(reportFile, JSON.stringify({generatedAt:new Date().toISOString(),results,failures}, null, 2) + "\n");
console.log("Generated " + results.length + " posters; failures " + failures.length);
if (failures.length) process.exitCode = 1;
