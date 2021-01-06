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
}) => {
  const lhsplitter  = useDefaultLocalStorageObject<number>('frames/lhsplitter', null);

  return (
    <SplitPane
      split='horizontal'
      defaultSize={lhsplitter.value || window.innerHeight / 2}
      onDragStarted={onDragStarted}
      onDragFinished={onDragFinishedSet(lhsplitter.set)}
      resizerClassName={puzzleVisible && sheetVisible ? 'Resizer' : 'nodisplay'}
      pane1Style={sheetVisible ? undefined : {height: '100%'}}
      pane2Style={puzzleVisible ? undefined : {height: '100%'}}
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
