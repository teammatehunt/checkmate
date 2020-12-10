chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
