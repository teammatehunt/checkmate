import React, {
  useEffect,
  useReducer,
  useRef,
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
          width='100%'
          height='100%'
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

export const canonicalUrl = (url: string) => {
  if (!url) return null;
  const _url = new URL(url);
  let combined = (_url.origin + _url.pathname).replace(/\/+$/, '');
  if (_url.host === 'docs.google.com') combined = combined.replace(/\/edit$/, '')
    return combined;
};

interface CachedIFrameProps {
  id: string;
  kind: string;
  src: string;
  title: string;
  isActive: boolean;
  isCached: boolean;
  currentUrl: string;
  reloadIfChangedTrigger: number;
  reloadTrigger: number;
}

export const CachedIFrame : React.FC<CachedIFrameProps> = ({
  isActive,
  isCached,
  currentUrl,
  reloadIfChangedTrigger,
  reloadTrigger,
  ...props
}) => {
  const [ownReloadTrigger, dispatchOwnReloadTrigger] = useReducer(state => state + 1, 0);
  const isActiveRef = useRef(isActive);
  const isChangedRef = useRef(false);
  isActiveRef.current = isActive;
  isChangedRef.current = canonicalUrl(currentUrl) !== canonicalUrl(props.src);

  useEffect(() => {
    if (isActiveRef.current && isChangedRef.current) dispatchOwnReloadTrigger();
  }, [reloadIfChangedTrigger]);
  useEffect(() => {
    if (isActiveRef.current) dispatchOwnReloadTrigger();
  }, [reloadTrigger]);

  const display = isActive ? DisplayType.DISPLAY : isCached && !isChangedRef.current ? DisplayType.HIDE : DisplayType.NO_RENDER;
  return (
    <IFrame key={ownReloadTrigger} display={display} {...props}/>
  );
};

export const puzzleUrl = (link, root) => {
  let hasOrigin = false;
  try {
    hasOrigin = Boolean(new URL(link).origin);
  } catch (error) {
  }
  const root_stripped = (root ?? '').slice(-1) === '/' ? root.slice(0, -1) : (root ?? '');
  const link_stripped = link[0] === '/' ? link.slice(1) : link;
  const url = link ? hasOrigin ? link : `${root_stripped}/${link_stripped}` : undefined;
  return url;
};

export const PuzzleFrame = ({
  id,
  hunt,
  isActive,
  isCached,
  puzzleData,
  currentUrl,
  reloadIfChangedTrigger,
  reloadTrigger,
}) => {
  const src = puzzleUrl(puzzleData.link, hunt?.root);
  return (
    <CachedIFrame
      id={id}
      kind='puzzle'
      src={src}
      title={puzzleData?.name}
      isActive={isActive}
      isCached={isCached}
      currentUrl={currentUrl}
      reloadIfChangedTrigger={reloadIfChangedTrigger}
      reloadTrigger={reloadTrigger}
    />
  );
};

export const SheetFrame = ({
  id,
  isActive,
  isCached,
  puzzleData,
  currentUrl,
  reloadIfChangedTrigger,
  reloadTrigger,
}) => {
  return (
    <CachedIFrame
      id={id}
      kind='sheet'
      src={puzzleData?.sheet_link}
      title={puzzleData?.name && `Spreadsheet for ${puzzleData?.name}`}
      isActive={isActive}
      isCached={isCached}
      currentUrl={currentUrl}
      reloadIfChangedTrigger={reloadIfChangedTrigger}
      reloadTrigger={reloadTrigger}
    />
  );
}

export const DiscordFrame = ({id, src, hasExtension}) => {
  if (hasExtension) {
    return (
      <IFrame
        id={id}
        kind='discord'
        src={src}
        title='Discord'
        display={DisplayType.DISPLAY}
      />
    );
  } else {
    return (
      <div className='no-extension'>
        <p>The Checkmate extension was not found. Follow the instructions <a href='/extension' target='_blank'>here</a>.</p>
      </div>
    );
  }
}

