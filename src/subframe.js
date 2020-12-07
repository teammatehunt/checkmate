const PARENT_REGEX = [
  '.*://localhost([:/].*)?',
  '.*://checkmate.teammatehunt.com(/.*)?',
].join('|');

const DISCORD_REGEX = '.*://(.*\.)?discord.com(/.*)?'
const DRIVE_REGEX = '.*://docs.google.com(/.*)?'

const addCSS = file => {
  let link = document.createElement( 'link' );
  link.href = file;
  link.type = 'text/css';
  link.rel = 'stylesheet';
  link.media = 'screen,print';
  let parentElement = document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0];
  parentElement.appendChild( link );
};

if (false) {
chrome.tabs.getCurrent(tab => {
  if (tab.id) {
    chrome.webNavigation.getFrame(
      {
        tabId: tab.id,
        frameId: 0,
      },
      rootFrame => {
        if (rootFrame.url.match(PARENT_REGEX)) {
          if (window.location.href.match(DISCORD_REGEX)) {
            addCSS(chrome.extension.getURL('discord.css'));
          }
          if (window.location.href.match(DRIVE_REGEX)) {
            addCSS(chrome.extension.getURL('drive.css'));
          }
        }
      }
    );
  }
});
}

