import mountElement from 'utils/mount';
import React, {
  useEffect,
  useState,
} from 'react';

import Base from 'components/base';
import InstallationChrome from 'assets/installation-chrome.png';
import InstallationFirefox from 'assets/installation-firefox.png';

import 'style/layout.css';
import 'style/extension.css';

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
            `**Detected the Checkmate extension v${clientExtensionVersion}!**`
            :
            '**The Checkmate extension was not detected.**'
          }
        </p>
        <p>
          <strong>
            Download: <a href='/static/checkmate-extension.zip' download>checkmate-extension.zip</a> (v{extension_version})
          </strong>
        </p>
        <p>
          This extension lets webpages load in iframes and performs some integrations, especially with Discord.
        </p>
        <h2>Instructions for Chrome</h2>
        <img src={InstallationChrome}/>
        <ol>
          <li>Unzip the extension.</li>
          <li>Copy and paste <span className='link'>chrome://extensions</span> into the address bar.</li>
          <li>Make sure <span className='red'>Developer mode</span> is on.</li>
          <li>Click <span className='orange'>Load unpacked</span> and select the extension directory.</li>
        </ol>
        <h2>Instructions for Firefox</h2>
        <img src={InstallationFirefox}/>
        <ol>
          <li>Copy and paste <span className='link'>about:debugging#/runtime/this-firefox</span> into the address bar.</li>
          <li>Select <span className='red'>Load Temporary Add-on</span> and select the extension zip file</li>
        </ol>
      </div>
    </Base>
  );
};

export default mountElement(GetExtension);
