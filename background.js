chrome.runtime.onMessage.addListener((message, _sender) => {
    if (message?.type === "TRACK_CHANGE") {
        updateDiscordPresence(message.track);
    }
});

function updateDiscordPresence(track) {
    // TODO
    console.log("UPDATE_PRESENCE", track);
}