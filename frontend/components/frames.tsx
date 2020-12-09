import React, {
  useEffect,
  useState,
} from 'react';

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
  name: string;
  src: string;
  title: string;
  display?: DisplayType;
};

export const IFrame : React.FC<IFrameProps> = ({
  name,
  src,
  title,
  display=DisplayType.DISPLAY,
}) => {
  if (!src) {
    return (
        <p>This puzzle does not have a URL set for the {name}.</p>
    );
  }
  return (
    <ShowIf display={display}>
      <iframe
        width="100%"
        height="100%"
        title={title}
        src={src}
      />
    </ShowIf>
  );
};

interface CachedIFrameProps {
  name: string;
  src: string;
  title: string;
  isActive: boolean;
}

export const CachedIFrame : React.FC<CachedIFrameProps> = ({isActive, ...props}) => {
  const [cached, setCached] = useState(DisplayType.NO_RENDER);
  useEffect(() => {
    if (isActive) setCached(DisplayType.HIDE);
  }, [isActive]);

  const display = isActive ? DisplayType.DISPLAY : cached;
  return (
    <IFrame display={display} {...props}/>
  );
};

export const PuzzleFrame = ({siteCtx, isActive, puzzleData}) => {
  const puzzleUrl = puzzleData?.link ? new URL(puzzleData?.link, siteCtx?.domain || undefined).href : undefined;
  return (
    <CachedIFrame
      name="puzzle"
      src={puzzleUrl}
      title={puzzleData?.name}
      isActive={isActive}
    />
  );
};

export const SheetFrame = ({isActive, puzzleData}) => {
  return (
    <CachedIFrame
      name="sheet"
      src={puzzleData?.sheet_link}
      title={puzzleData?.name && `Spreadsheet for ${puzzleData?.name}`}
      isActive={isActive}
    />
  );
}

export const DiscordFrame = ({src}) => {
  return (
    <IFrame
      name="discord"
      src={src}
      title="Discord"
      display={DisplayType.DISPLAY}
    />
  );
}

