if (window.name !== 'discord') {
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
            event: (({
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
            }))(e),
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
