const PARENT_REGEX = [
  '.*://localhost([:/].*)?',
  '.*://checkmate.teammatehunt.com(/.*)?',
].join('|');

const DISCORD_REGEX = '.*://(.*\.)?discord.com(/.*)?'
const DRIVE_REGEX = '.*://docs.google.com(/.*)?'

const STRIPPED_HEADERS = [
  'content-security-policy',
  'x-frame-options',
];

let matchedRequestsCache = {};
let frameNames = {}; // {[tabId]: {[frameId]: string}}
let discordInfo = {}; // {[tabId]: {[parentFrameId]: {frameId, serverId, voiceChannelId, textChannelId}}}
let discordFrame = {}; // {[tabId]: [frameId]}
const DISCORD_FRAME = 'discord';

const logError = () => {
  if (chrome.runtime.lastError) {
    console.log('Error:', chrome.runtime.lastError.message);
    return true;
  }
  return false;
}

const sendLoadDiscord = (tabId, message) => {
  chrome.tabs.sendMessage(
    tabId,
    message,
    {
      frameId: message.frameId,
    },
    logError,
  );
}

chrome.webRequest.onBeforeRequest.addListener(
  details => {
    if (details.tabId >= 0) {
      chrome.webNavigation.getFrame(
        {
          tabId: details.tabId,
          // frameId: details.parentFrameId,
          frameId: 0,
        },
        parentFrame => {
          if (logError()) return;
          if (parentFrame && parentFrame.url.match(PARENT_REGEX)) {
            matchedRequestsCache[details.requestId] = true;
          }
        },
      );
    }
  },
  {
    urls: ['<all_urls>'],
    types: ['sub_frame', 'object'],
  },
  [],
)

chrome.webRequest.onHeadersReceived.addListener(
  details => {
    if (details.tabId < 0) {
      return {responseHeaders: details.responseHeaders};
    }
    // firefox uses originUrl and documentUrl, chrome uses initiator
    const parentUrl = details.documentUrl || details.initiator;
    // The webNavigation API should be faster than the request, but fallback on
    // parentUrl. Unfortunately, we can't just wait on the webNavigation result
    // becase the webRequest API must be synchronous.
    if (matchedRequestsCache[details.requestId] || (parentUrl && parentUrl.match(PARENT_REGEX))) {
      details.responseHeaders = details.responseHeaders.filter(
        x => !STRIPPED_HEADERS.includes(x.name.toLowerCase())
      );
      delete matchedRequestsCache[details.requestId];
    }
    return {responseHeaders: details.responseHeaders};
  },
  {
    urls: ['<all_urls>'],
    types: ['sub_frame', 'object'],
  },
  ['blocking', 'responseHeaders', 'extraHeaders'],
);

// Add styles for matching embedded urls
chrome.webNavigation.onDOMContentLoaded.addListener(details => {
  if (details.tabId >= 0 && details.parentFrameId >= 0) {
    chrome.webNavigation.getFrame(
      {
        tabId: details.tabId,
        frameId: details.parentFrameId,
      },
      parentFrame => {
        if (logError()) return;
        if (!parentFrame) return;
        if (parentFrame.url.match(PARENT_REGEX)) {
          // set site-specific CSS
          if (details.url.match(DISCORD_REGEX)) {
            chrome.tabs.insertCSS(
              details.tabId,
              {
                frameId: details.frameId,
                file: 'discord.css',
              },
              logError,
            );
          }
          if (details.url.match(DRIVE_REGEX)) {
            chrome.tabs.insertCSS(
              details.tabId,
              {
                frameId: details.frameId,
                file: 'drive.css',
              },
              logError,
            );
          }
          // tell parent that url loaded / changed
          const sendUrl = (name) => {
            chrome.tabs.sendMessage(
              details.tabId,
              {
                action: 'loaded-subframe',
                frameId: details.frameId,
                url: details.url,
                name: name,
              },
              {
                frameId: details.parentFrameId,
              },
              logError,
            );
          };
          if (!(details.tabId in frameNames)) frameNames[details.tabId] = {};
          const name = frameNames[details.tabId][details.frameId];
          chrome.tabs.executeScript(
            details.tabId,
            {
              frameId: details.frameId,
              file: '/keyhandler.js',
            },
            logError,
          );
          chrome.tabs.executeScript(
            details.tabId,
            {
              frameId: details.frameId,
              file: '/subframe.js',
              runAt: 'document_start',
            },
            (results) => {
              if (logError()) return;
              if (details.url.match(DISCORD_REGEX)) {
                const message = (discordInfo[details.tabId]||{})[details.frameId];
                if (message) sendLoadDiscord(details.tabId, message);
              }
              if (name === undefined) {
                if (results && results.length) {
                  const [result] = results;
                  frameNames[details.tabId][details.frameId] = result;
                  sendUrl(result);
                  if (details.parentFrameId === 0 && result === DISCORD_FRAME) {
                    discordFrame[details.tabId] = details.frameId;
                  }
                }
              } else {
                sendUrl(name);
              }
            },
          );
        }
      },
    );
  }
});

const moveDiscordVoiceHandler = async (message, sender, sendResponse) => {
  if (sender.tab) {
    chrome.webNavigation.getFrame(
      {
        tabId: sender.tab.id,
        frameId: sender.frameId,
      },
      frame => {
        if (logError() || !frame) {
          sendResponse({status: 500});
          return;
        }
        chrome.tabs.sendMessage(
          sender.tab.id,
          message,
          {
            frameId: frame.parentFrameId,
          },
          (response) => {
            if (logError()) {
              sendResponse({status: 500});
              return;
            }
            sendResponse(response);
          },
        );
      },
    );
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id === chrome.runtime.id) {
    switch (message.action) {
    case 'load-discord':
      if (!(sender.tab.id in discordInfo)) discordInfo[sender.tab.id] = {};
      discordInfo[sender.tab.id][sender.frameId] = message;
      sendLoadDiscord(sender.tab.id, message);
      sendResponse();
      break;
    case 'keydown-discord':
      if (sender.tab.id in discordFrame) {
        chrome.tabs.sendMessage(
          sender.tab.id,
          message,
          {
            frameId: discordFrame[sender.tab.id],
          },
          logError,
        );
      }
      sendResponse();
      break;
    case 'move-discord-voice':
      moveDiscordVoiceHandler(message, sender, sendResponse);
      return true; // respond asynchronously
    }
  }
});
