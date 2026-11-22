// bring-the-humans-03 — entry program (Node 22, standard library only).
//
// This program does one thing: it hands VIDEO.json to the grader.
// The repository root holds VIDEO.json with the address of the TikTok
// video this entry is about; the grader reads it from /output, so this
// program copies it there. Before copying, it reads the file and checks
// it really is a JSON object with a string "url" field, and that the
// URL is a well-formed TikTok video address, so a broken VIDEO.json
// fails loudly here instead of silently passing a bad file through.
// The copy itself is a plain byte copy, so what lands in /output is
// byte for byte the repository's VIDEO.json.
//
// Nothing is fetched, no clock is read, and no file outside the
// repository is touched — the two runs of an entry write the same bytes.
//
// Run it the way the grader does:
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
// ... then out/VIDEO.json is byte for byte this directory's VIDEO.json.

import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Where the repository lives, and where the grader wants the file.
// The two environment variables stand in for /bot and /output outside
// the grader's container; inside it they are unset and the defaults win.
const repoDir = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const source = join(repoDir, 'VIDEO.json');
const target = join(outDir, 'VIDEO.json');

// Validate first: the file must parse as JSON and name a video URL.
let parsed: unknown;
try {
  parsed = JSON.parse(readFileSync(source, 'utf8'));
} catch (error) {
  console.error(`VIDEO.json in ${repoDir} is not valid JSON: ${(error as Error).message}`);
  process.exit(1);
}
if (
  typeof parsed !== 'object' ||
  parsed === null ||
  typeof (parsed as { url?: unknown }).url !== 'string' ||
  (parsed as { url: string }).url.length === 0
) {
  console.error(`VIDEO.json in ${repoDir} has no string "url" field.`);
  process.exit(1);
}

// A TikTok video id: digits only.
const VIDEO_ID = /^[0-9]+$/;

// Extract the video id from a TikTok video address, or throw a
// specific error saying exactly what is wrong with it. Only two
// shapes are accepted: tiktok.com/@<handle>/video/<id> (also on
// www. and m.) and m.tiktok.com/v/<id>.html. Each failure mode gets
// its own message so a broken VIDEO.json tells the operator what to
// fix instead of just failing.
function extractVideoId(rawUrl: string): string {
  const url = rawUrl.trim();
  if (url.length === 0) {
    throw new Error('VIDEO.json "url" is empty');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`VIDEO.json "url" is not a valid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`VIDEO.json "url" must use https: ${url}`);
  }
  if (parsed.username !== '' || parsed.password !== '' || parsed.port !== '') {
    throw new Error(`VIDEO.json "url" must be a plain TikTok link: ${url}`);
  }

  const host = parsed.hostname.toLowerCase();
  if (host === 'vm.tiktok.com' || host === 'vt.tiktok.com') {
    throw new Error(`VIDEO.json "url" is a short link, open it and copy the full address: ${url}`);
  }
  const isTikTok =
    host === 'tiktok.com' || host === 'www.tiktok.com' || host === 'm.tiktok.com';
  if (!isTikTok) {
    throw new Error(`VIDEO.json "url" is not a TikTok address: ${url}`);
  }

  // Photo posts are not videos.
  if (parsed.pathname.includes('/photo/')) {
    throw new Error(`VIDEO.json "url" is a photo post, not a video: ${url}`);
  }

  let id: string | null = null;
  const videoMatch = parsed.pathname.match(/^\/@[^/]+\/video\/([0-9]+)\/?$/);
  if (videoMatch) {
    id = videoMatch[1];
  } else {
    const vMatch = parsed.pathname.match(/^\/v\/([0-9]+)\.html$/);
    if (vMatch) {
      id = vMatch[1];
    }
  }
  if (id === null) {
    throw new Error(
      `VIDEO.json "url" is not a TikTok video address (want /@<handle>/video/<id>): ${url}`,
    );
  }
  if (!VIDEO_ID.test(id)) {
    throw new Error(`VIDEO.json "url" has a video id that is not digits only: ${id}`);
  }
  return id;
}

// Validate the URL's shape through extractVideoId, which throws a
// specific error for each kind of bad address.
const url = (parsed as { url: string }).url;
let videoId: string;
try {
  videoId = extractVideoId(url);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
console.log(`validated VIDEO.json (video ${videoId})`);

// Byte-for-byte copy, so the grader sees exactly this repository's file.
mkdirSync(outDir, { recursive: true });
try {
  copyFileSync(source, target);
} catch (error) {
  console.error(`Could not copy ${source} to ${target}: ${(error as Error).message}`);
  process.exit(1);
}
