var voiceChannelId = null;

const parseDiscordLocation = (link) => {
  const url = new URL(link);
  const isDiscord = url.hostname === 'discord.com';
  const [_, serverId, channelId] = url.pathname.match(/\/channels\/(\d+|@me)(?:\/(\d+))?\/?/) || [];
  return [isDiscord, serverId, channelId];
}

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (sender.id === chrome.runtime.id) {
    switch (message.action) {
    case 'load-discord':
      if (message.serverId === null || (message.textChannelId === null && message.voiceChannelId === null)) return;
      const [initialIsDiscord, initialServerId, initialChannelId] = parseDiscordLocation(window.location.href);
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
        const [currentIsDiscord, currentServerId, currentChannelId] = parseDiscordLocation(window.location.href);
        if (!currentIsDiscord) fail = true;
        if (currentServerId !== message.serverId) fail = true;
        if (currentChannelId !== message.textChannelId && currentChannelId !== message.voiceChannelId) fail = true;
      }
      // hard refresh
      if (fail) {
        window.location.href = `https://discord.com/channels/${message.serverId}/${message.textChannelId}`;
      }
      // set voiceChannelId
      voiceChannelId = message.voiceChannelId;
      // load CSS
      if (message.voiceChannelId !== null) {
        VOICE_ID = 'voice-chat-for-puzzle'
        let voiceElement = document.getElementById(VOICE_ID);
        if (voiceElement === null) {
          voiceElement = document.createElement('div');
          voiceElement.id = VOICE_ID;
          document.body.appendChild(voiceElement);
        }
        voiceElement.onclick = () => {
          const elt = document.querySelector(`a[data-list-item-id='channels___${message.voiceChannelId}']`);
          if (elt) elt.click();
        };
      }
    }
  }
});

if (parseDiscordLocation(window.location.href)[0]) {
  window.addEventListener('load', () => {
    const panelElement = document.querySelector(`section[class^='panels-'][aria-label='User area'] > div[class^='wrapper']`);
    const chatElement = document.querySelector(`div[class^='sidebar-'] + div[class^='chat-']`);
    if (panelElement) {
      const setVoiceState = () => {
        const currentState = document.body.getAttribute('voice-state');
        let newState = 'none';
        if (panelElement.hasChildNodes()) {
          const link = panelElement.querySelector(`div[class^='rtcConnectionStatus-'] + a`).href;
          const channelId = parseDiscordLocation(link)[2];
          const matchPuzzle = voiceChannelId !== null && channelId === voiceChannelId;
          const screenChannelId = parseDiscordLocation(window.location.href)[2];
          const voiceScreen = channelId !== null && channelId === screenChannelId;
          newState = `active ${matchPuzzle ? 'current-puzzle' : 'other-channel'} ${voiceScreen ? 'voice-screen' : 'other-screen'}`;
        }
        if (newState !== currentState) document.body.setAttribute('voice-state', newState);
      };
      const observer = new MutationObserver(setVoiceState);
      observer.observe(panelElement, {
        attributes: true,
        childList: true,
        subtree: true,
      });
      if (chatElement) {
        observer.observe(chatElement, {
          childList: true,
        });
      }
      setVoiceState();
    }
  });
}


// return window name
window.name;
