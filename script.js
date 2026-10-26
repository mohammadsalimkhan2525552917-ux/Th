// Detect platform and extract the video ID from a pasted URL.
function parseVideo(raw) {
  const url = raw.trim();
  let m;
  m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (m) return { platform: "YouTube", id: m[1] };
  m = url.match(/vimeo\.com\/(?:.*\/)?(\d{6,})/);
  if (m) return { platform: "Vimeo", id: m[1], page: url };
  m = url.match(/(?:dailymotion\.com\/video\/|dai\.ly\/)([A-Za-z0-9]+)/);
  if (m) return { platform: "Dailymotion", id: m[1] };
  return null;
}

// Returns candidate thumbnail URLs, best quality first.
async function getThumbnailCandidates(video) {
  if (video.platform === "YouTube") {
    const base = `https://img.youtube.com/vi/${video.id}`;
    return [`${base}/maxresdefault.jpg`, `${base}/sddefault.jpg`, `${base}/hqdefault.jpg`];
  }
  if (video.platform === "Dailymotion") {
    return [`https://www.dailymotion.com/thumbnail/video/${video.id}`];
  }
  if (video.platform === "Vimeo") {
    const res = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(video.page)}`);
    if (!res.ok) throw new Error("Vimeo video not found or is private.");
    const data = await res.json();
    return [data.thumbnail_url_with_play_button || data.thumbnail_url].filter(Boolean);
  }
  return [];
}

// Load the first candidate that actually loads as an image.
function loadFirstImage(urls) {
  return new Promise((resolve, reject) => {
    let i = 0;
    const tryNext = () => {
      if (i >= urls.length) return reject(new Error("No thumbnail could be loaded."));
      const src = urls[i++];
      const img = new Image();
      img.onload = () => {
        // YouTube returns a 120x90 placeholder when maxres is missing.
        if (img.naturalWidth <= 120 && i < urls.length) return tryNext();
        resolve({ src, img });
      };
      img.onerror = tryNext;
      img.src = src;
    };
    tryNext();
  });
}

// Download an image as a file; fall back to opening it in a new tab.
async function downloadImage(src, filename) {
  try {
    const res = await fetch(src);
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } catch {
    window.open(src, "_blank", "noopener");
  }
}

function setupDownloader() {
  const form = document.getElementById("dl-form");
  if (!form) return;
  const input = document.getElementById("video-url");
  const btn = document.getElementById("dl-btn");
  const msg = document.getElementById("message");
  const result = document.getElementById("result");
  const preview = document.getElementById("preview");
  const saveBtn = document.getElementById("save-btn");
  const openBtn = document.getElementById("open-btn");
  let currentSrc = null;
  let currentName = "thumbnail.jpg";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const video = parseVideo(input.value);
    result.classList.remove("show");
    if (!video) {
      msg.className = "message error";
      msg.textContent = "Hmm, that doesn't look like a YouTube, Vimeo, or Dailymotion link.";
      return;
    }
    btn.disabled = true;
    msg.className = "message";
    msg.textContent = "Fetching thumbnail... ✨";
    try {
      const candidates = await getThumbnailCandidates(video);
      const { src } = await loadFirstImage(candidates);
      currentSrc = src;
      currentName = `${video.platform.toLowerCase()}-${video.id}-thumbnail.jpg`;
      preview.src = src;
      result.classList.add("show");
      msg.className = "message ok";
      msg.textContent = `Got it! ${video.platform} thumbnail ready 🎉`;
    } catch (err) {
      msg.className = "message error";
      msg.textContent = err.message || "Something went wrong. Please try again.";
    } finally {
      btn.disabled = false;
    }
  });

  saveBtn.addEventListener("click", () => currentSrc && downloadImage(currentSrc, currentName));
  openBtn.addEventListener("click", () => currentSrc && window.open(currentSrc, "_blank", "noopener"));
}

function setupContact() {
  const form = document.getElementById("contact-form");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const note = document.getElementById("contact-note");
    note.textContent = "Thanks! Your message has been noted. We'll get back to you soon 💌";
    form.reset();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupDownloader();
  setupContact();
  document.querySelectorAll("[data-year]").forEach(el => el.textContent = new Date().getFullYear());
});
