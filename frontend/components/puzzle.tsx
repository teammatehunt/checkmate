import React, {
  useContext,
  useEffect,
  useState,
} from 'react';

import { useLocalStorage } from '@rehooks/local-storage';
import SplitPane, { Pane } from 'react-split-pane';

import {
  ShowIf,
  PuzzleFrame,
  SheetFrame,
} from 'components/frames';
import * as Model from 'utils/model';
import { useDefaultLocalStorageObject } from 'utils/hooks';

interface IframeDetails {
  action: 'loaded-subframe';
  frameId: number;
  url: string;
  name: string;
}

interface PuzzlesProps {
  isActive: boolean;
  tabs: string[];
  slug: string;
  puzzles: Model.Puzzles;
  hunt: Model.HuntConfig;
  iframeDetails: {[name: string]: IframeDetails};
  onDragStarted: any;
  onDragFinishedSet: any;
  puzzleVisible: boolean;
  sheetVisible: boolean;
  reloadIfChangedTrigger: number;
  reloadPuzzleTrigger: number;
  reloadSheetTrigger: number;
  cachedTabSet: Set<string>;
  puzzleSplitVertical: boolean;
}

const Puzzles : React.FC<PuzzlesProps> = ({
  isActive,
  tabs,
  slug,
  puzzles,
  hunt,
  iframeDetails,
  onDragStarted,
  onDragFinishedSet,
  puzzleVisible,
  sheetVisible,
  reloadIfChangedTrigger,
  reloadPuzzleTrigger,
  reloadSheetTrigger,
  cachedTabSet,
  puzzleSplitVertical,
}) => {
  const lsplitter = useDefaultLocalStorageObject<number>('frames/lsplitter', null);

  return (
    <SplitPane
      split={puzzleSplitVertical ? 'vertical' : 'horizontal'}
      defaultSize={lsplitter.value || (puzzleSplitVertical ? window.innerWidth / 4 : window.innerHeight / 2)}
      minSize={50}
      maxSize={-50}
      onDragStarted={onDragStarted}
      onDragFinished={onDragFinishedSet(lsplitter.set)}
      resizerClassName={puzzleVisible && sheetVisible ? 'Resizer' : 'nodisplay'}
      pane1Style={sheetVisible ? undefined : puzzleSplitVertical ? {width: '100%'} : {height: '100%'}}
      pane2Style={puzzleVisible ? undefined : puzzleSplitVertical ? {width: '100%'} : {height: '100%'}}
      /* @ts-ignore */
      pane1ClassName={puzzleVisible ? '' : 'nodisplay'}
      pane2ClassName={sheetVisible ? '' : 'nodisplay'}
    >
      <div className='puzzle pane'>
        {tabs.map(tab => (
          <div key={tab}>
            <PuzzleFrame
              id={`puzzle/${tab}`}
              hunt={hunt}
              isActive={isActive && tab === slug}
              isCached={tab === slug || cachedTabSet.has(tab)}
              puzzleData={puzzles[tab]}
              currentUrl={iframeDetails[`puzzle/${tab}`]?.url}
              reloadIfChangedTrigger={reloadIfChangedTrigger}
              reloadTrigger={reloadPuzzleTrigger}
            />
          </div>
        ))}
      </div>
      <div className='sheet pane'>
        {tabs.map(tab => (
          <div key={tab}>
            <SheetFrame
              id={`sheet/${tab}`}
              isActive={isActive && tab === slug}
              isCached={tab === slug || cachedTabSet.has(tab)}
              puzzleData={puzzles[tab]}
              currentUrl={iframeDetails[`sheet/${tab}`]?.url}
              reloadIfChangedTrigger={reloadIfChangedTrigger}
              reloadTrigger={reloadSheetTrigger}
            />
          </div>
        ))}
      </div>
    </SplitPane>
  );
};

export default Puzzles;
