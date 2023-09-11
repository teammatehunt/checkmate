const PARENT_REGEX = [
  '.*://localhost([:/].*)?',
  '.*://checkmate.teammatehunt.com(/.*)?',
].join('|');
const SUBFRAME_FILTER = {
  urls: ['<all_urls>'],
  types: ['sub_frame', 'object'],
};

const DISCORD_REGEX = '.*://(.*\.)?discord.com(/.*)?'
const DRIVE_REGEX = '.*://docs.google.com(/.*)?'

const STRIPPED_HEADERS = [
  'content-security-policy',
  'x-frame-options',
];

const frameNames = {}; // {[tabId]: {[frameId]: string}}
const discordInfo = {}; // {[tabId]: {[parentFrameId]: {frameId, serverId, voiceChannelId, textChannelId}}}
const discordFrame = {}; // {[tabId]: [frameId]}
const DISCORD_FRAME = 'discord';
const cookieStores = {}; // {[storeId]: {[domain]: {[path]: {[name]: Cookie}}}}
let tabId2storeId = {}; // {[tabId]: string}
const checkmateTabIds = new Set();

const logError = () => {
  if (chrome.runtime.lastError) {
    console.log('Error:', chrome.runtime.lastError.message);
    return true;
  }
  return false;
};

const isEmpty = obj => {
  for (const key in obj) return false;
  return true;
};

const sendLoadDiscord = (tabId, message) => {
  chrome.tabs.sendMessage(
    tabId,
    message,
    {
      frameId: message.frameId,
    },
    logError,
  );
};

chrome.webRequest.onBeforeRequest.addListener(
  details => {
    if (details.tabId >= 0) {
      if (details.url.match(PARENT_REGEX)) {
        checkmateTabIds.add(details.tabId);
      } else {
        checkmateTabIds.delete(details.tabId);
      }
      chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [1, 2],
        addRules: [
          {
            id: 1,
            condition: {
              tabIds: Array.from(checkmateTabIds),
            },
            action: {
              type: 'modifyHeaders',
              responseHeaders: STRIPPED_HEADERS.map(header => ({
                  header,
                  operation: 'remove',
              })),
            },
          },
          {
            id: 2,
            condition: {
              tabIds: Array.from(checkmateTabIds),
              resourceTypes: ['sub_frame'],
            },
            action: {
              type: 'modifyHeaders',
              requestHeaders: [{
                header: 'sec-fetch-dest',
                operation: 'set',
                value: 'frame',
              }],
            },
          },
        ],
      });
    }
  },
  {
    urls: ['<all_urls>'],
    types: ['main_frame'],
  },
);

// TODO: maybe re-add cookie injection? might be hard with Manifest V3 restrictions
/*
chrome.webRequest.onBeforeSendHeaders.addListener(
  details => {
    if (details.tabId < 0) return;
    if (!checkmateTabIds.has(details.tabId)) return;
    const time = new Date() / 1000;
    const cookies = {}; // {[name]: Cookie}
    const cookieStore = cookieStores[tabId2storeId[details.tabId]];
    if (cookieStore !== undefined) {
      const url = new URL(details.url);
      const domainCookies = cookieStore[url.hostname];
      if (domainCookies !== undefined) {
        for (const path in domainCookies) {
          if (url.pathname === path || url.pathname.startsWith(path.replace(/\/*$/, '/'))) {
            const pathCookies = domainCookies[path];
            for (const cookie of Object.values(pathCookies)) {
              if (cookie.expirationDate !== undefined && cookie.expirationDate < time) continue;
              if (cookie.hostOnly && url.hostname !== cookie.domain) continue;
              if (cookie.secure && url.protocol !== 'https') continue;
              // ignore sameSite
              if (cookie.name in cookies && cookies[cookie.name].path.length > cookie.path.length) continue;
              cookies[cookie.name] = cookie;
            }
          }
        }
      }
    }
    const cookieValue = Object.values(cookies).map(cookie => `${cookie.name}=${encodeURIComponent(cookie.value)}`).join('; ');
    let foundCookies = false;
    for (const header of details.requestHeaders) {
      if (!foundCookies && header.name === 'Cookie') {
        foundCookies = true;
        if (!isEmpty(cookies)) {
          const cookieValueAppend = '; ' + cookieValue;
          if (header.value !== undefined) {
            header.value += cookieValueAppend;
          } else {
            const encoded = new TextEncoder(cookieValueAppend);
            header.binaryValue = [...header.binaryValue, ...encoded];
          }
        }
      }
      if (header.name === 'Sec-Fetch-Dest') {
        if (header.value === 'iframe') header.value = 'frame';
      }
    }
    if (!foundCookies) {
      if (!isEmpty(cookies)) {
        details.requestHeaders.push({
          name: 'Cookie',
          value: cookieValue,
        })
      }
    }
    return {requestHeaders: details.requestHeaders};
  },
  SUBFRAME_FILTER,
  ['blocking', 'requestHeaders', 'extraHeaders'],
);

// set cookies
const setCookies = details => {
  if (!checkmateTabIds.has(details.tabId)) return;
  const hostname = new URL(details.url).hostname;
  if (!hostname) return;
  const storeId = tabId2storeId[details.tabId];
  if (storeId === undefined) return;
  chrome.cookies.getAll(
    {
      domain: hostname,
      storeId: storeId,
    },
    cookies => {
      const cookieStore = {};
      for (const cookie of Object.values(cookies)) {
        if (cookie.sameSite !== 'no_restriction') {
          if (!(cookie.domain in cookieStore)) cookieStore[cookie.domain] = {};
          const domainCookies = cookieStore[cookie.domain];
          if (!(cookie.path in domainCookies)) domainCookies[cookie.path] = {};
          const pathCookies = domainCookies[cookie.path];
          if (!(cookie.name in pathCookies)) pathCookies[cookie.name] = {};
          pathCookies[cookie.name] = cookie;
        }
      }
      if (!(storeId in cookieStores)) cookieStores[storeId] = {};
      for (const domain in cookieStore) {
        cookieStores[storeId][domain] = cookieStore[domain];
      }
    },
  );
};
chrome.webRequest.onCompleted.addListener(
  setCookies,
  SUBFRAME_FILTER,
);
chrome.webRequest.onErrorOccurred.addListener(
  setCookies,
  SUBFRAME_FILTER,
);

// remove cookies
chrome.cookies.onChanged.addListener(changeInfo => {
  // overwritten cookies will be gone anyways, avoid race condition
  if (changeInfo.remove && changeInfo.cause !== 'overwrite') {
    const cookie = changeInfo.cookie;
    const cookieStore = cookieStores[cookie.storeId];
    if (cookieStore === undefined) return;
    const domainCookies = cookieStore[cookie.domain];
    if (domainCookies === undefined) return;
    const pathCookies = domainCookies[cookie.path];
    if (pathCookies === undefined) return;
    delete pathCookies[cookie.name];
    if (isEmpty(pathCookies)) delete domainCookies[cookie.path];
    if (isEmpty(domainCookies)) delete cookieStore[cookie.domain];
    if (isEmpty(cookieStore)) delete cookieStores[cookie.storeId];
  }
});

// set tabId2storeId map
const setCookieStores = () => {
  chrome.cookies.getAllCookieStores(_cookieStores => {
    const _tabId2storeId = {};
    for (const cookieStore of Object.values(_cookieStores)) {
      for (const tabId of cookieStore.tabIds) {
        _tabId2storeId[tabId] = cookieStore.id;
      };
    };
    tabId2storeId = _tabId2storeId;
  });
};
chrome.tabs.onCreated.addListener(setCookieStores);
setCookieStores();
*/

// Add styles for top level of iframes
chrome.webNavigation.onDOMContentLoaded.addListener(details => {
  if (!checkmateTabIds.has(details.tabId)) return;
  if (details.parentFrameId !== 0) return;
  // set site-specific CSS
  if (details.url.match(DISCORD_REGEX)) {
    chrome.scripting.insertCSS({
      target: {
        tabId: details.tabId,
        frameIds: [details.frameId],
      },
      files: ['discord.css'],
    }).then(logError);
  }
  if (details.url.match(DRIVE_REGEX)) {
    chrome.scripting.insertCSS({
      target: {
        tabId: details.tabId,
        frameIds: [details.frameId],
      },
      files: ['drive.css'],
    }).then(logError);
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
  chrome.scripting.executeScript({
    target: {
      tabId: details.tabId,
      frameIds: [details.frameId],
    },
    files: ['/keyhandler.js'],
  }).then(logError);
  chrome.scripting.executeScript({
    target: {
      tabId: details.tabId,
      frameIds: [details.frameId],
    },
    files: ['/subframe.js'],
    injectImmediately: true,
  }).then((results) => {
    if (logError()) return;
    if (details.url.match(DISCORD_REGEX)) {
      const message = (discordInfo[details.tabId]||{})[details.frameId];
      if (message) sendLoadDiscord(details.tabId, message);
    }
    if (name === undefined) {
      if (results && results.length) {
        const [result] = results;
        const name = result.result;
        frameNames[details.tabId][details.frameId] = name;
        sendUrl(name);
        if (details.parentFrameId === 0 && name === DISCORD_FRAME) {
          discordFrame[details.tabId] = details.frameId;
        }
      }
    } else {
      sendUrl(name);
    }
  });
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
