const getCookie = (name) => {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      // Does this cookie string begin with the name we want?
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

const fetchJson = async ({url, data, ...kwargs}) => {
  let browserFetch = fetch;
  try {
    // for firefox
    if (content.fetch) browserFetch = content.fetch;
  } catch (err) {
  }
  return await browserFetch(url, {
    headers: {
      'X-CSRFToken': getCookie('csrftoken'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
    ...kwargs,
  });
};

const moveDiscordVoiceHandler = async (message, sendResponse) => {
  // use our own api
  fetchJson({
    url: '/api/discord_voice_move',
    method: 'POST',
    data: {
      channel_id: message.channelId,
    },
  }).then(response => sendResponse({status: response.status}))
    .catch (err => sendResponse({status: 500}));
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id === chrome.runtime.id) {
    switch (message.action) {
    case 'loaded-subframe':
      // firefox requires cloning the object in the window space
      const localDetail = Object.assign(new window.Object(), message);
      const e = new CustomEvent('loaded-subframe', {detail: localDetail});
      window.dispatchEvent(e);
      break;
    case 'move-discord-voice':
      moveDiscordVoiceHandler(message, sendResponse);
      return true; // respond asynchronously
    }
  }
});

window.addEventListener('ping', () => {
  // firefox requires cloning the object in the window space
  const localDetail = Object.assign(new window.Object(), {
    version: chrome.runtime.getManifest().version,
  });
  window.dispatchEvent(new CustomEvent('pong', {detail: localDetail}));
});
window.addEventListener('load-discord', (e) => {
  if (!e.detail.frameId) return;
  if (!e.detail.serverId) return;
  chrome.runtime.sendMessage(
    {
      ...e.detail,
      action: 'load-discord',
    },
    {},
    () => {
      if (chrome.runtime.lastError) {
        console.log('Error:', chrome.runtime.lastError.message);
      }
    },
  );
});
