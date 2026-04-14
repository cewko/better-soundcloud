chrome.runtime.onMessage.addListener((message, _sender) => {
  if (message?.type === "TRACK_CHANGE") {
    updateDiscordPresence(message.track);
    sendWebHook(message.track);
  }
});

function updateDiscordPresence(track) {
  // TODO
  console.log("UPDATE_PRESENCE", track);
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
  const { webhookEnabled, webhookEndpoint, webhookSecret } =
    await chrome.storage.sync.get([
      "webhookEnabled",
      "webhookEndpoint",
      "webhookSecret",
    ]);

  if (!webhookEnabled || !webhookEndpoint || !webhookSecret) return;

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
