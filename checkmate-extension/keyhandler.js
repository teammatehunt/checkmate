const transformKeyEvent = ({
  altKey,
  charCode,
  code,
  ctrlKey,
  key,
  keyCode,
  metaKey,
  shiftKey,
  which,
}) => ({
  altKey,
  charCode,
  code,
  ctrlKey,
  key,
  keyCode,
  metaKey,
  shiftKey,
  which,
});

if (window.name.startsWith('sheet/')) {
  // capture ctrl + shift + v
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey) {
      switch (e.key) {
      case 'V':
        e.preventDefault();
        // save current selection
        const selection = window.getSelection();
        const selectionRange = selection.getRangeAt(0);

        // paste as text/plain and recopy
        const clipboardElement = document.createElement('textarea');
        document.body.appendChild(clipboardElement);
        clipboardElement.select();
        document.execCommand('paste');
        clipboardElement.select();
        document.execCommand('copy');
        document.body.removeChild(clipboardElement);

        // reselect saved selection and paste
        selection.removeAllRanges();
        selection.addRange(selectionRange);
        document.execCommand('paste');
      }
    }
  });
}

if (!window.name.startsWith('discord/')) {
  // capture ctrl + shift + m and ctrl + shift + d
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey) {
      switch (e.key) {
      case 'D':
      case 'M':
        e.preventDefault();
        chrome.runtime.sendMessage(
          {
            action: 'keydown-discord',
            event: transformKeyEvent(e),
          },
          {},
          () => {
            if (chrome.runtime.lastError) {
              console.log('Error:', chrome.runtime.lastError.message);
            }
          },
        );
      }
    }
  });
}
