const toggle = document.getElementById("toggleButton");
const DRPToggle = document.getElementById("DRPToggleButton");
const webhookToggle = document.getElementById("webhookToggleButton");

const discordClientIDInput = document.getElementById("discordClientID");
const endpointInput = document.getElementById("endpointInput");
const secretInput = document.getElementById("secretInput");

const saveDRPButton = document.getElementById("saveDRPButton");
const saveWebhookBtn = document.getElementById("saveWebhookBtn");

const statusMessage = document.getElementById("statusMessage");

const gearBtn = document.getElementById("gearBtn");
const settingsPanel = document.getElementById("settingsPanel");

// disable other els when the main toggle is disabled

function setSubsystemsEnabled(mainEnabled) {
  [discordClientIDInput, endpointInput, secretInput, saveDRPButton, saveWebhookBtn]
    .forEach(el => el.disabled = !mainEnabled);
}

// load saves state

chrome.storage.sync.get(
  [
    "enabled", 
    "DRPEnabled", 
    "discordClientID", 
    "webhookEnabled", 
    "webhookEndpoint", 
    "webhookSecret"
  ],
  ({ 
    enabled, 
    DRPEnabled, 
    discordClientID, 
    webhookEnabled, 
    webhookEndpoint, 
    webhookSecret 
  }) => {
    toggle.classList.toggle("on", !!enabled);
    DRPToggle.classList.toggle("on", !!DRPEnabled);
    discordClientIDInput.value = discordClientID || "";
    webhookToggle.classList.toggle("on", !!webhookEnabled);
    endpointInput.value = webhookEndpoint || "";
    secretInput.value = webhookSecret || "";

    setSubsystemsEnabled(!!enabled);
  },
);

// settings toggle

gearBtn.addEventListener("click", () => {
  const open = settingsPanel.classList.toggle("open");
  gearBtn.classList.toggle("open", open);
});

// extension toggle

toggle.addEventListener("click", () => {
  toggle.classList.toggle("on");
  const nowEnabled = toggle.classList.contains("on");
  chrome.storage.sync.set({ enabled: nowEnabled });

  notifyTab(nowEnabled);
  chrome.runtime.sendMessage({ type: "TOGGLE", enabled: nowEnabled });
  
  setSubsystemsEnabled(nowEnabled);
});

// drp toggle

DRPToggle.addEventListener("click", () => {
  DRPToggle.classList.toggle("on");
  const nowEnabled = DRPToggle.classList.contains("on");
  chrome.storage.sync.set({ DRPEnabled: nowEnabled });

  if (!nowEnabled) {
    chrome.runtime.sendMessage({ type: "TOGGLE", enabled: false });
  }
});

// save drp config 

saveDRPButton.addEventListener("click", () => {
  const clientID = discordClientID.value.trim();

  if (!clientID) {
    showStatus("Client ID not provided", "err");
    return;
  }

  if (!/^\d+$/.test(clientID)) {
    showStatus("Invalid Client ID", "err");
    return;
  }

  chrome.storage.sync.set(
    { discordClientID: clientID },
    () => {
      showStatus("Success!", "ok");
    },
  );
})

// webhook toggle

webhookToggle.addEventListener("click", () => {
  webhookToggle.classList.toggle("on");
  const nowEnabled = webhookToggle.classList.contains("on");
  chrome.storage.sync.set({ webhookEnabled: nowEnabled });
});

// save webhook config

saveWebhookBtn.addEventListener("click", () => {
  const endpoint = endpointInput.value.trim();
  const secret = secretInput.value.trim();

  if (!endpoint || !secret) {
    showStatus("URL & Password required", "err");
    return;
  }

  if (!isValidUrl(endpoint)) {
    showStatus("Invalid URL", "err");
    return;
  }

  chrome.storage.sync.set(
    { webhookEndpoint: endpoint, webhookSecret: secret },
    () => {
      showStatus("Success!", "ok");
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