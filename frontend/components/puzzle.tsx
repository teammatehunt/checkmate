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

interface PuzzlesProps {
  isActive: boolean;
  tabs: string[];
  slug: string;
  puzzles: Model.Puzzles;
  siteCtx: Context.SiteContextType;
  onDragStarted: any;
  onDragFinishedSet: any;
}

const Puzzles : React.FC<PuzzlesProps> = ({
  isActive,
  tabs,
  slug,
  puzzles,
  siteCtx,
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
              siteCtx={siteCtx}
              isActive={isActive && tab === slug}
              puzzleData={puzzles[tab]}
            />
          </div>
        ))}
      </div>
      <div className='sheet pane'>
        {tabs.map(tab => (
          <div key={tab}>
            <SheetFrame
              isActive={isActive && tab === slug}
              puzzleData={puzzles[tab]}
            />
          </div>
        ))}
      </div>
    </SplitPane>
  );
};

export default Puzzles;
