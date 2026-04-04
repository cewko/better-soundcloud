const toggle = document.getElementById("toggleButton");

chrome.storage.sync.get('enabled', ({ enabled }) => {
  toggle.classList.toggle('on', !!enabled);
});

toggle.addEventListener("click", () => {
  toggle.classList.toggle("on");
  const nowEnabled = toggle.classList.contains('on');
  chrome.storage.sync.set({ enabled: nowEnabled });

  notifyTab(nowEnabled);
})

function notifyTab(enabled) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE', enabled });
    }
  });
}