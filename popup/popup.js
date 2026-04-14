const toggle = document.getElementById("toggleButton");
const webhookToggle = document.getElementById("webhookToggleButton");
const endpointInput = document.getElementById("endpointInput");
const secretInput = document.getElementById("secretInput");
const saveBtn = document.getElementById("saveBtn");
const statusMessage = document.getElementById("statusMessage");

// load saves state

chrome.storage.sync.get(
  ["enabled", "webhookEnabled", "webhookEndpoint", "webhookSecret"],
  ({ enabled, webhookEnabled, webhookEndpoint, webhookSecret }) => {
    toggle.classList.toggle("on", !!enabled);
    webhookToggle.classList.toggle("on", !!webhookEnabled);
    endpointInput.value = webhookEndpoint || "";
    secretInput.value = webhookSecret || "";
  },
);

// extension toggle

toggle.addEventListener("click", () => {
  toggle.classList.toggle("on");
  const nowEnabled = toggle.classList.contains("on");
  chrome.storage.sync.set({ enabled: nowEnabled });

  notifyTab(nowEnabled);
});

// webhook toggle

webhookToggle.addEventListener("click", () => {
  webhookToggle.classList.toggle("on");
  const nowEnabled = webhookToggle.classList.contains("on");
  chrome.storage.sync.set({ webhookEnabled: nowEnabled });
});

// save webhook config

saveBtn.addEventListener("click", () => {
  const endpoint = endpointInput.value.trim();
  const secret = secretInput.value.trim();

  if (!endpoint || !secret) {
    showStatus("Endpoint and secret required", "err");
    return;
  }

  if (!isValidUrl(endpoint)) {
    showStatus("Invalid URL", "err");
    return;
  }

  chrome.storage.sync.set(
    { webhookEndpoint: endpoint, webhookSecret: secret },
    () => {
      showStatus("Saved", "ok");
    },
  );
});

// helpers

function notifyTab(enabled) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: "TOGGLE", enabled });
    }
  });
}

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol == "https:" || u.protocol == "http:";
  } catch {
    return false;
  }
}

function showStatus(msg, type = "") {
  statusMessage.textContent = msg;
  statusMessage.className = type;
  setTimeout(() => {
    statusMessage.textContent = "";
    statusMessage.className = "";
  }, 2000);
}
