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
}) => {
  const [lhsplitter, setLhsplitter] = useLocalStorage<number>('frames/lhsplitter', null);

  return (
    <SplitPane
      split='horizontal'
      defaultSize={lhsplitter || window.innerHeight / 2}
      onDragStarted={onDragStarted}
      onDragFinished={onDragFinishedSet(setLhsplitter)}
      resizerClassName={puzzleVisible && sheetVisible ? 'Resizer' : 'nodisplay'}
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
              puzzleData={puzzles[tab]}
              currentUrl={iframeDetails[`puzzle/${tab}`]?.url}
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
              puzzleData={puzzles[tab]}
              currentUrl={iframeDetails[`sheet/${tab}`]?.url}
            />
          </div>
        ))}
      </div>
    </SplitPane>
  );
};

export default Puzzles;
