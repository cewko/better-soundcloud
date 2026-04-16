let nativePort = null;
let startTimestamp = null;
let pausedAt = null;
let lastTrack = null;

chrome.runtime.onMessage.addListener((message, _sender) => {
  if (message?.type === "TRACK_CHANGE") {
    lastTrack = message.track;
    startTimestamp = Date.now();
    pausedAt = null;
    updateDiscordPresence(message.track);
    sendWebHook(message.track);
  }

  if (message?.type === "PLAY_STATE") {
    if (!message.playing && pausedAt === null) {
      pausedAt = Date.now();
      clearDiscordPresence();
    } else if (message.playing && pausedAt !== null ) {
      const pausedDuration = Date.now() - pausedAt;
      startTimestamp += pausedDuration;
      pausedAt = null;
      if ( lastTrack ) updateDiscordPresence(lastTrack);
    }
  }

  if (message?.type == "TOGGLE") {
    if (!message.enabled) {
      clearDiscordPresence();
      lastTrack = null;
      startTimestamp = null;
      pausedAt = null;
    }
  }
});

function clearDiscordPresence() {
  postToHost({ type: "CLEAR_ACTIVITY" });
}

function connectNativeHost() {
  nativePort = chrome.runtime.connectNative("com.bettersoundcloud.host");
  nativePort.onMessage.addListener((msg) => {
    console.log("native host: ", msg);
  })

  nativePort.onDisconnect.addListener(() => {
    console.warn("native host disconnected", chrome.runtime.lastError?.message);
    nativePort = null;
    setTimeout(connectNativeHost, 5000);
  })
}

function postToHost(msg) {
  if (!nativePort) connectNativeHost();
  nativePort.postMessage(msg);
}

async function updateDiscordPresence(track) {
  const { enabled, DRPEnabled, discordClientID } = await chrome.storage.sync.get(["enabled", "DRPEnabled", "discordClientID"]);
  if (!enabled || !DRPEnabled || !discordClientID) {
    clearDiscordPresence();
    return;
  }

  if (!track.title && !track.author) {
    nativePort.postMessage({ type: "CLEAR_ACTIVITY"});
    return;
  }

  const msg = (!track.title && !track.author)
    ? { type: "CLEAR_ACTIVITY" }
    : {
        type: "SET_ACTIVITY",
        clientID: discordClientID,
        activity: {
          details: track.title || "unknown track",
          state: track.author || "unknown",
          timestamps: { start: startTimestamp },
          assets: {
            large_image: track.artwork || "soundcloud_logo",
            large_text: track.title,
            small_image: "soundcloud_logo",
            small_text: "Better SoundCloud by cewko",
          },
          buttons: [{ label: "Listen on SoundCloud", url: track.url }],
          instance: false,
        },
      };

  postToHost(msg);
}

async function hmacSign(secret, body) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sendWebHook(track) {
  const { enabled, webhookEnabled, webhookEndpoint, webhookSecret } =
    await chrome.storage.sync.get([
      "enabled",
      "webhookEnabled",
      "webhookEndpoint",
      "webhookSecret",
    ]);

  if (!enabled || !webhookEnabled || !webhookEndpoint || !webhookSecret) return;

  const body = JSON.stringify({
    track,
    timestamp: Date.now(),
  });
  let signature;

  try {
    signature = await hmacSign(webhookSecret, body);
  } catch (err) {
    console.error("failed to sign webhook payload:", err);
    return;
  }

  try {
    const res = await fetch(webhookEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature": signature,
      },
      body,
    });
    if (!res.ok) {
      console.error(`webhook request failed with status ${res.status}`);
    }
  } catch (err) {
    console.error("failed to send webhook request:", err);
  }
}
