import mountElement from 'utils/mount';
import React, {
  useEffect,
  useState,
} from 'react';

import Base from 'components/base';
import InstallationChrome from 'assets/extension/installation-chrome.png';
import InstallationFirefox from 'assets/extension/installation-firefox.png';

import 'style/layout.css';
import 'style/documentation.css';

export const GetExtension = ({
  extension_version,
}) => {
  const [clientExtensionVersion, setClientExtensionVersion] = useState(undefined);
  // Check for extension
  useEffect(() => {
    const handler = (e) => setClientExtensionVersion(e.detail?.version);
    window.addEventListener('pong', handler);
    window.dispatchEvent(new Event('ping'));
    return () => window.removeEventListener('pong', handler);
  }, []);

  return (
    <Base>
      <title>Checkmate Extension</title>
      <div className='root'>
        <p className='extension-detection'>
          {clientExtensionVersion ?
            `**Detected the Checkmate extension v${clientExtensionVersion} in your browser!**`
            :
            '**The Checkmate extension was not detected in your browser.**'
          }
        </p>

        <h1>Checkmate Extension</h1>
        <p>
          This extension lets webpages load in iframes and performs some integrations, especially with Discord.
        </p>
        <h2>Instructions for Chrome</h2>
        <img className='center' src={InstallationChrome}/>
        <p>
          <strong>
            Chrome Download: <a href='/static/checkmate-extension.zip' download>checkmate-extension.zip</a> (v{extension_version})
          </strong>
        </p>
        <ol>
          <li>Unzip the extension.</li>
          <li>Copy and paste <span className='link'>chrome://extensions</span> into the address bar.</li>
          <li>Make sure <span className='red'>Developer mode</span> is on.</li>
          <li>Click <span className='orange'>Load unpacked</span> and select the extension directory.</li>
        </ol>
        <h2>Instructions for Firefox</h2>
        <img className='center' src={InstallationFirefox}/>
        <p>
          <strong>
            Firefox Download: <a href='/static/checkmate-extension.xpi' download>checkmate-extension.xpi</a> (v{extension_version})
          </strong>
        </p>
        <ol>
          <li>Copy and paste <span className='link'>about:addons</span> into the address bar.</li>
          <li>Open the management drop-down, click <span className='red'>Install Add-on From File...</span>, and select the extension file.</li>
        </ol>
      </div>
    </Base>
  );
};

export default mountElement(GetExtension);
