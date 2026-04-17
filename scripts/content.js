const STORAGE_KEY = "enabled";
const ACTIVE_CLASS = "sce-active";
const HIDDEN_ATTR = "data-sc-hidden";

const SELECTORS = {
  section: ".mixedModularHome__item",
  titles: [
    '[data-test-id="selection__title-text"]',
    '[data-test-id="velvet-cake__title-text"]',
  ].join(","),
  player: ".playbackSoundBadge",
  trackTitle: '.playbackSoundBadge__titleLink span[aria-hidden="true"]',
  trackAuthor: ".playbackSoundBadge__lightLink",
  trackLink: ".playbackSoundBadge__titleLink",
  trackArtwork: ".playbackSoundBadge .sc-artwork[style]",
  playButton: ".playControls__play",
  trackDuration: ".playbackTimeline__duration span[aria-hidden='true']",
};

const HIDDEN_SECTION_TITLES = new Set([
  "Recently Played",
  "Events near you",
  "New crew, suggested for you",
  "Discover with Stations",
  "Artists to watch out for",
  "Curated by SoundCloud",
  "Albums for you",
  "Made for you",
]);

let playObserver = null;
let lastPlayingState = null;

function ensurePlayObserver() {
  if (playObserver?.active) return;

  const btn = document.querySelector(SELECTORS.playButton);
  if (!btn) return;

  playObserver = createObserver(
    btn,
    { attributes: true, attributeFilter: ["class"] },
    () => {
      const playing = isPlaying();
      if (playing !== lastPlayingState) {
        lastPlayingState = playing;
        notifyPlayState(playing);
      }
    }
  );
  playObserver.start();
}

function isPlaying() {
  const btn = document.querySelector(SELECTORS.playButton);
  return btn?.classList.contains("playing") ?? false;
}

function createObserver(target, options, callback) {
  let observer = null;

  return {
    start() {
      if (observer) return;
      observer = new MutationObserver(callback);
      observer.observe(target, options);
    },
    stop() {
      if (!observer) return;
      observer.disconnect();
      observer = null;
    },
    get active() {
      return observer !== null;
    },
  };
}

function hideMatchingSections() {
  document.querySelectorAll(SELECTORS.titles).forEach((titleEl) => {
    const text = titleEl?.textContent?.trim();
    if (!HIDDEN_SECTION_TITLES.has(text)) return;

    const section = titleEl.closest(SELECTORS.section);
    if (!section || section.hasAttribute(HIDDEN_ATTR)) return;

    section.style.display = "none";
    section.setAttribute(HIDDEN_ATTR, "true");
  });
}

function restoreHiddenSections() {
  document
    .querySelectorAll(`${SELECTORS.section}[${HIDDEN_ATTR}]`)
    .forEach((section) => {
      section.style.display = "";
      section.removeAttribute(HIDDEN_ATTR);
    });
}

function convertDurationSeconds(string) {
  if (!string) return null;

  const parts = string.split(":").map(Number);

  if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  }

  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  }

  return null;
}

function extractCurrentTrack() {
  const titleEl = document.querySelector(SELECTORS.trackTitle);
  const authorEl = document.querySelector(SELECTORS.trackAuthor);
  const linkEl = document.querySelector(SELECTORS.trackLink);
  const artworkEl = document.querySelector(SELECTORS.trackArtwork);
  const durationEl = document.querySelector(SELECTORS.trackDuration);

  const artworkUrl =
    artworkEl?.style.backgroundImage.match(/url\("?(.+?)"?\)/)?.[1] ?? "";

  const durationString = durationEl?.textContent?.trim() || "";
  const durationSeconds = convertDurationSeconds(durationString);

  return {
    title: titleEl?.textContent?.trim() || titleEl?.title || "",
    author: authorEl?.textContent?.trim() || authorEl?.title || "",
    url: linkEl?.href || window.location.href,
    artwork: artworkUrl,
    duration: durationSeconds,
  };
}

const domObserver = createObserver(
  document.body,
  { childList: true, subtree: true },
  hideMatchingSections,
);

let trackObserver = null;
let lastTrackKey = null;

function ensureTrackObserver() {
  if (trackObserver?.active) return;

  const player = document.querySelector(SELECTORS.player);
  if (!player) return;

  trackObserver = createObserver(
    player,
    { childList: true, subtree: true, characterData: true },
    onPlayerMutation,
  );
  trackObserver.start();
}

function onPlayerMutation() {
  const track = extractCurrentTrack();
  const key = `${track.author}::${track.title}`;

  if (key !== lastTrackKey) {
    lastTrackKey = key;
    notifyTrackChange(track);
  }
}

function notifyPlayState(playing) {
  chrome.runtime.sendMessage({ type: "PLAY_STATE", playing })
}

function notifyTrackChange(track) {
  chrome.runtime.sendMessage({ type: "TRACK_CHANGE", track });
}

function applyExtensionState(isEnabled) {
  document.documentElement.classList.toggle(ACTIVE_CLASS, isEnabled);

  if (isEnabled) {
    hideMatchingSections();
    domObserver.start();
    ensureTrackObserver();
    ensurePlayObserver();
  } else {
    domObserver.stop();
    restoreHiddenSections();
    trackObserver?.stop();
    playObserver?.stop();
  }
}

chrome.storage.sync.get(STORAGE_KEY, ({ [STORAGE_KEY]: isEnabled }) => {
  applyExtensionState(Boolean(isEnabled));
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "TOGGLE") {
    applyExtensionState(Boolean(message.enabled));
  }
});
