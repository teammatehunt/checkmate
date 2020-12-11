import React, {
  useContext,
  useEffect,
  useState,
} from 'react';

import { useLocalStorage } from '@rehooks/local-storage';
import SplitPane, { Pane } from 'react-split-pane';

import * as Context from 'components/context';
import {
  ShowIf,
  PuzzleFrame,
  SheetFrame,
} from 'components/frames';
import * as Model from 'components/model';

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
  siteCtx: Context.SiteContextType;
  iframeDetails: {[name: string]: IframeDetails};
  onDragStarted: any;
  onDragFinishedSet: any;
}

const Puzzles : React.FC<PuzzlesProps> = ({
  isActive,
  tabs,
  slug,
  puzzles,
  siteCtx,
  iframeDetails,
  onDragStarted,
  onDragFinishedSet,
}) => {
  const [lhsplitter, setLhsplitter] = useLocalStorage<number>('frames/lhsplitter', null);

  const renderPuzzle = true;
  const renderSheet = true;
  const renderPuzzleAndSheet = renderPuzzle && renderSheet;
  const renderOnlyPuzzle = renderPuzzle && !renderSheet;
  const renderOnlySheet = !renderPuzzle && renderSheet;

  const puzzlePaneStyle = renderOnlyPuzzle ? {height: '100%'} : renderOnlySheet ? {display: 'none'} : {};
  const sheetPaneStyle = renderOnlySheet ? {height: '100%'} : renderOnlyPuzzle ? {display: 'none'} : {};

  return (
    <SplitPane
      split='horizontal'
      defaultSize={lhsplitter || window.innerHeight / 2}
      onDragStarted={onDragStarted}
      onDragFinished={onDragFinishedSet(setLhsplitter)}
      resizerClassName={renderPuzzleAndSheet ? 'Resizer' : 'nodisplay'}
      pane1Style={puzzlePaneStyle}
      pane2Style={sheetPaneStyle}
    >
      <div className='puzzle pane'>
        {tabs.map(tab => (
          <div key={tab}>
            <PuzzleFrame
              id={`puzzle/${tab}`}
              siteCtx={siteCtx}
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
