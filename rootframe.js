chrome.runtime.onMessage.addListener((message, sender) => {
  if (sender.id === chrome.runtime.id) {
    switch (message.action) {
    case 'loaded-subframe':
      // firefox requires cloning the object in the window space
      const localMessage = Object.assign(new window.Object(), message);
      const e = new CustomEvent('loaded-subframe', {detail: localMessage});
      window.dispatchEvent(e);
      break;
    }
  }
});

window.addEventListener('ping', () => window.dispatchEvent(new Event('pong')));
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
