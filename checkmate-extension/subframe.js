var serverId = null;
var voiceChannelId = null;

const parseDiscordLocation = (link) => {
  const url = new URL(link);
  const isDiscord = url.hostname === 'discord.com';
  const [_, serverId, channelId] = url.pathname.match(/\/channels\/(\d+|@me)(?:\/(\d+))?\/?/) || [];
  return [isDiscord, serverId, channelId];
}

const setVoiceState = () => {
  const currentState = document.body.getAttribute('voice-state');
  const [isDiscord, currentServerId, currentChannelId] = parseDiscordLocation(window.location.href);
  let classes = [];
  classes.push(voiceChannelId ? 'puzzle-given' : 'puzzle-not-given');
  if (voiceChannelId && currentServerId === serverId) {
    const puzzleElement = document.querySelector(`a[data-list-item-id='channels___${voiceChannelId}']`);
    classes.push(puzzleElement === null ? 'puzzle-channel-exists' : 'puzzle-channel-not-exists');
  }
  const panelElement = document.querySelector(`section[class^='panels-'][aria-label='User area'] > div[class^='wrapper']`);
  if (panelElement && panelElement.hasChildNodes()) {
    classes.push('in-voice');
    const link = (panelElement.querySelector(`div[class^='rtcConnectionStatus-'] + a`)||{}).href;
    const currentVoiceChannelId = parseDiscordLocation(link)[2];
    const matchPuzzle = voiceChannelId !== null && currentVoiceChannelId === voiceChannelId;
    const voiceScreen = currentVoiceChannelId !== null && currentVoiceChannelId === currentChannelId;
    classes.push(matchPuzzle ? 'in-puzzle-channel' : 'in-other-channel');
    classes.push(voiceScreen ? 'on-voice-screen' : 'on-other-screen');
  } else {
    classes.push('no-voice');
  }
  const newState = classes.join(' ');
  if (newState !== currentState) document.body.setAttribute('voice-state', newState);
};

const asyncClickChannel = async (serverId, channelId) => {
  if (serverId) {
    const element = document.querySelector(`[data-list-item-id='guildsnav___${serverId}']`);
    if (element) {
      element.click();
    } else {
      return false;
    }
  }
  const clickChannel = () => {
    const element = document.querySelector(`[data-list-item-id='channels___${channelId}']`);
    if (element) {
      element.click();
      return true;
    } else {
      return false;
    }
  };
  if (clickChannel()) {
    return true;
  } else {
    // attempt to scroll to find the channel
    const scroll = async() => {
      const channelsElement = document.getElementById('channels');
      if (!channelsElement) return false;
      for (let top=0; top < channelsElement.scrollHeight; top+=channelsElement.getBoundingClientRect().height) {
        channelsElement.scroll({top: top, behavior: 'auto'});
        // let scolling and renders happen
        await new Promise(r => setTimeout(r, 0));
        // sometimes rendering is slow to get to top
        // wait up to 0.5s if not within 10 pixels of top
        let ms = 0;
        while (top === 0 && channelsElement.scrollTop > 10 && ms < 500) {
          const timeout = 100;
          await new Promise(r => setTimeout(r, timeout));
          ms += timeout;
        }
        if (clickChannel()) return true;
      }
      channelsElement.scroll({top: channelsElement.scrollHeight, behaviour: 'auto'});
      if (clickChannel()) return true;
      return false;
    }
    if (await scroll()) {
      return true;
    }
  }
  return false;
};

const asyncOnMessage = async (message, sender) => {
  if (sender.id === chrome.runtime.id) {
    switch (message.action) {
    case 'load-discord':
      // set voiceChannelId
      serverId = message.serverId;
      voiceChannelId = message.voiceChannelId;
      if (message.serverId !== null && (message.textChannelId !== null || message.voiceChannelId !== null)) {
        const [initialIsDiscord, initialServerId, initialChannelId] = parseDiscordLocation(window.location.href);
        let fail = false;
        // try click events
        if (initialIsDiscord) {
          const _serverId = initialServerId === message.serverId ? null : message.serverId;
          if (initialChannelId !== message.textChannelId && initialChannelId !== message.voiceChannelId) {
            if (!await asyncClickChannel(_serverId, message.textChannelId)) {
              fail = true;
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
      }
      // load CSS
      const VOICE_ID = 'voice-chat-for-puzzle'
      let voiceElement = document.getElementById(VOICE_ID);
      if (voiceElement === null) {
        voiceElement = document.createElement('button');
        voiceElement.id = VOICE_ID;
        voiceElement.setAttribute('aria-label', 'Open Voice for Puzzle');
        voiceElement.setAttribute('type', 'button');
        svgElement = makeJigsawSvg();
        voiceElement.appendChild(svgElement);
        document.body.appendChild(voiceElement);
      }
      voiceElement.onclick = async () => {
        const [initialIsDiscord, initialServerId, initialChannelId] = parseDiscordLocation(window.location.href);
        // try click events
        await asyncClickChannel(message.voiceChannelId)
        if (initialIsDiscord) {
          const _serverId = initialServerId === serverId ? null : serverId;
          await asyncClickChannel(_serverId, message.voiceChannelId)
        }
      };
      setVoiceState();
      break;
    case 'keydown-discord':
      if (parseDiscordLocation(window.location.href)[0]) { // isDiscord
        window.dispatchEvent(new KeyboardEvent('keydown', message.event));
      }
      break;
    }
  }
};
chrome.runtime.onMessage.addListener((message, sender) => asyncOnMessage(message, sender));

// update voice state class
if (parseDiscordLocation(window.location.href)[0]) {
  window.addEventListener('load', () => {
    const panelElement = document.querySelector(`section[class^='panels-'][aria-label='User area'] > div[class^='wrapper']`);
    const chatElement = document.querySelector(`div[class^='sidebar-'] + div[class^='chat-']`);
    if (panelElement) {
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

const makeJigsawSvg = () => {
  let svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgElement.setAttribute('width', '20');
  svgElement.setAttribute('height', '20');
  svgElement.setAttribute('viewBox', '0 0 485.28 485.28');
  let pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pathElement.setAttribute('d',
    `
    M411.013,219.761c-10.387,0-20.212,2.217-29.14,6.136c-3.475,1.525-7.486,1.194-10.663-0.883s-5.085-5.616-5.085-9.411
    v-62.697c0-18.884-15.302-34.181-34.186-34.181h-70.065c-3.769,0-7.287-1.89-9.369-5.033c-2.081-3.143-2.452-7.122-0.978-10.591
    c3.708-8.732,5.796-18.301,5.796-28.402c0-41.019-33.252-74.267-74.267-74.267c-41.02,0-74.254,33.248-74.254,74.267
    c0,10.101,2.082,19.671,5.789,28.403c1.474,3.471,1.108,7.45-0.974,10.594c-2.082,3.144-5.602,5.029-9.373,5.029H34.187
    C15.302,118.726,0,134.023,0,152.907v297.761c0,18.877,15.302,34.179,34.187,34.179h67.564c3.613,0,6.989-1.728,9.108-4.659
    c2.102-2.92,2.706-6.672,1.557-10.102c-2.32-7.039-3.613-14.531-3.613-22.365c0-41.011,33.234-74.268,74.254-74.268
    c41.015,0,74.267,33.256,74.267,74.268c0,7.835-1.306,15.327-3.631,22.365c-1.131,3.429-0.541,7.181,1.561,10.102
    c2.115,2.931,5.509,4.659,9.104,4.659h67.582c18.885,0,34.186-15.302,34.186-34.179v-78.232c0-3.793,1.914-7.33,5.09-9.406
    c3.175-2.075,7.186-2.412,10.659-0.887c8.928,3.919,18.752,6.137,29.139,6.137c41.02,0,74.267-33.241,74.267-74.25
    C485.28,253.008,452.033,219.761,411.013,219.761z
    `
  );
  pathElement.setAttribute('fill', 'currentColor');
  svgElement.appendChild(pathElement);
  return svgElement;
};

// return window name
window.name;
