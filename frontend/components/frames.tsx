import React, {
  useEffect,
  useState,
} from 'react';

import { featureList } from 'utils/feature-policy';

export enum DisplayType {
  HIDE = 0, // false
  DISPLAY = 1, // true
  NO_RENDER,
}

export const ShowIf = ({display, children,  ...props}) => {
  display = Number(display);
  if (display === DisplayType.NO_RENDER) return null;
  let {className, ..._props} = props;
  let classes = className ? [className] : [];
  classes.push(display === DisplayType.DISPLAY ? 'active' : 'nodisplay');
  const _className = classes.join(' ');
  return (
    <div className={_className} {..._props}>
      {children}
    </div>
  );
};

interface IFrameProps {
  id: string,
  kind: string;
  src: string;
  title: string;
  display?: DisplayType;
};

export const IFrame : React.FC<IFrameProps> = ({
  id,
  kind,
  src,
  title,
  display=DisplayType.DISPLAY,
}) => {
  return (
    <ShowIf display={display}>
      {src ?
        <iframe
          name={id}
          width="100%"
          height="100%"
          title={title}
          src={src}
          allow={featureList}
        />
        :
        <p>This puzzle does not have {kind} link.</p>
      }
    </ShowIf>
  );
};

const canonicalPath = (url: string) => {
  if (!url) return null;
  const _url = new URL(url);
  return (_url.origin + _url.pathname).replace(/\/+$/, '');
};

interface CachedIFrameProps {
  id: string;
  kind: string;
  src: string;
  title: string;
  isActive: boolean;
  currentUrl: string;
}

export const CachedIFrame : React.FC<CachedIFrameProps> = ({isActive, currentUrl, ...props}) => {
  const [cached, setCached] = useState(DisplayType.NO_RENDER);
  useEffect(() => {
    if (canonicalPath(currentUrl) !== canonicalPath(props.src)) {
      setCached(DisplayType.NO_RENDER);
    } else {
      if (isActive) setCached(DisplayType.HIDE);
    }
  }, [isActive]);

  const display = isActive ? DisplayType.DISPLAY : cached;
  return (
    <IFrame display={display} {...props}/>
  );
};

export const PuzzleFrame = ({id, siteCtx, isActive, puzzleData, currentUrl}) => {
  let hasOrigin = false;
  try {
    hasOrigin = Boolean(new URL(puzzleData?.link).origin);
  } catch (error) {
  }
  const root_stripped = (siteCtx?.root ?? '').slice(-1) === '/' ? siteCtx.root.slice(0, -1) : (siteCtx?.root ?? '');
  const link_stripped = puzzleData.link[0] === '/' ? puzzleData.link.slice(1) : puzzleData.link;
  const puzzleUrl = puzzleData?.link ? hasOrigin ? puzzleData.link : `${root_stripped}/${link_stripped}` : undefined;
  return (
    <CachedIFrame
      id={id}
      kind="puzzle"
      src={puzzleUrl}
      title={puzzleData?.name}
      isActive={isActive}
      currentUrl={currentUrl}
    />
  );
};

export const SheetFrame = ({id, isActive, puzzleData, currentUrl}) => {
  return (
    <CachedIFrame
      id={id}
      kind="sheet"
      src={puzzleData?.sheet_link}
      title={puzzleData?.name && `Spreadsheet for ${puzzleData?.name}`}
      isActive={isActive}
      currentUrl={currentUrl}
    />
  );
}

export const DiscordFrame = ({id, src, hasExtension}) => {
  if (hasExtension) {
    return (
      <IFrame
        id={id}
        kind="discord"
        src={src}
        title="Discord"
        display={DisplayType.DISPLAY}
      />
    );
  } else {
    return (
      <div className="no-extension">
        <p>The Checkmate extension was not found. Follow the instructions <a href='/extension' target='_blank'>here</a>.</p>
      </div>
    );
  }
}

