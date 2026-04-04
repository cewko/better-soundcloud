const STORAGE_KEY = 'enabled';
const ACTIVE_CLASS = 'sce-active';
const HIDDEN_ATTR = 'data-sc-hidden';

const SELECTORS = {
  section: '.mixedModularHome__item',
  titles: [
    '[data-test-id="selection__title-text"]',
    '[data-test-id="velvet-cake__title-text"]',
  ].join(','),
};

const hiddenSectionTitles = new Set([
  'Recently Played',
  'Events near you',
  'New crew, suggested for you',
  'Discover with Stations',
  'Artists to watch out for',
  'Curated by SoundCloud',
  'Albums for you',
  'Made for you',
]);

let mutationObserver = null;

init();

function init() {
  chrome.storage.sync.get(STORAGE_KEY, ({ [STORAGE_KEY]: isEnabled }) => {
    applyExtensionState(Boolean(isEnabled));
  });

  chrome.runtime.onMessage.addListener(handleMessage);
}

function handleMessage(message) {
  if (message?.type === 'TOGGLE') {
    applyExtensionState(Boolean(message.enabled));
  }
}

function applyExtensionState(isEnabled) {
  toggleRootClass(isEnabled);

  if (isEnabled) {
    hideMatchingSections();
    startDomObserver();
  } else {
    stopDomObserver();
    restoreHiddenSections();
  }
}

function toggleRootClass(isEnabled) {
  document.documentElement.classList.toggle(ACTIVE_CLASS, isEnabled);
}

function hideMatchingSections() {
  const titleElements = document.querySelectorAll(SELECTORS.titles);

  titleElements.forEach((titleElement) => {
    const titleText = titleElement.textContent?.trim();
    if (!hiddenSectionTitles.has(titleText)) return;

    const section = titleElement.closest(SELECTORS.section);
    if (!section || section.hasAttribute(HIDDEN_ATTR)) return;

    hideSection(section);
  });
}

function hideSection(sectionEl) {
  sectionEl.style.display = 'none';
  sectionEl.setAttribute(HIDDEN_ATTR, 'true');
}

function restoreHiddenSections() {
  const hiddenSections = document.querySelectorAll(
    `${SELECTORS.section}[${HIDDEN_ATTR}]`
  );

  hiddenSections.forEach((section) => {
    section.style.display = '';
    section.removeAttribute(HIDDEN_ATTR);
  });
}

function startDomObserver() {
  if (mutationObserver) return;

  mutationObserver = new MutationObserver(() => {
    hideMatchingSections();
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function stopDomObserver() {
  if (!mutationObserver) return;

  mutationObserver.disconnect();
  mutationObserver = null;
}