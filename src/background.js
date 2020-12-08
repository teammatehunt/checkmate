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

chrome.webRequest.onBeforeRequest.addListener(
  details => {
    if (details.tabId >= 0) {
      chrome.webNavigation.getFrame(
        {
          tabId: details.tabId,
          frameId: details.parentFrameId,
        },
        parentFrame => {
          if (parentFrame.url.match(PARENT_REGEX)) {
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
    if (matchedRequestsCache[details.requestId] || parentUrl.match(PARENT_REGEX)) {
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
  ['blocking', 'responseHeaders'],
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
        if (!parentFrame) return;
        if (parentFrame.url.match(PARENT_REGEX)) {
          if (details.url.match(DISCORD_REGEX)) {
            chrome.tabs.insertCSS(
              details.tabId,
              {
                frameId: details.frameId,
                file: 'discord.css',
              },
            );
          }
          if (details.url.match(DRIVE_REGEX)) {
            chrome.tabs.insertCSS(
              details.tabId,
              {
                frameId: details.frameId,
                file: 'drive.css',
              },
            );
          }
        }
      },
    );
  }
});
