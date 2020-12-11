chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (sender.id === chrome.runtime.id) {
    switch (message.action) {
    case 'load-discord':
      if (message.serverId === null || (message.textChannelId === null && message.voiceChannelId === null)) return;
      console.log(message);
      const parseLocation = () => {
        const url = new URL(window.location.href);
        const isDiscord = url.hostname === 'discord.com';
        const [_, serverId, channelId] = url.pathname.match(/\/channels\/(\d+|@me)(?:\/(\d+))?\/?/) || [];
        return [isDiscord, serverId, channelId];
      }
      const [initialIsDiscord, initialServerId, initialChannelId] = parseLocation();
      let fail = false;
      // try click events
      if (initialIsDiscord) {
        if (initialServerId !== message.serverId) {
          const element = document.querySelector(`[data-list-item-id='guildsnav___${message.serverId}']`);
          if (element) {
            element.click();
          } else {
            fail = true;
          }
        }
        if (!fail && initialChannelId !== message.textChannelId && initialChannelId !== message.voiceChannelId) {
          if (message.textChannelId !== null) {
            const element = document.querySelector(`[data-list-item-id='channels___${message.textChannelId}']`);
            if (element) {
              element.click();
            } else {
              fail = true;
            }
          }
        }
      }
      if (!fail) {
        const [currentIsDiscord, currentServerId, currentChannelId] = parseLocation();
        if (!currentIsDiscord) fail = true;
        if (currentServerId !== message.serverId) fail = true;
        if (currentChannelId !== message.textChannelId && currentChannelId !== message.voiceChannelId) fail = true;
      }
      // hard refresh
      if (fail) {
        window.location.href = `https://discord.com/channels/${message.serverId}/${message.textChannelId}`;
      }
      break;
    }
  }
});

// return window name
window.name;
