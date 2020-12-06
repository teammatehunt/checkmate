import React, {
  useContext,
  useEffect,
  useState,
} from 'react';

import SplitPane, { Pane } from 'react-split-pane';

import * as Context from 'components/context';
import { ShowIf } from 'components/frames';
import * as Model from 'components/model';

import 'style/split-pane.css';

interface PuzzleProps {
  isActive: boolean;
  slug: string;
  puzzleData: Model.Puzzle;
}

const Puzzle : React.FC<PuzzleProps> = ({
  isActive,
  slug,
  puzzleData,
}) => {
  const [cached, setCached] = useState(false);

  useEffect(() => {
    if (isActive) setCached(false);
  }, [isActive]);

  const shouldRender = isActive || cached;
  const siteCtx = useContext(Context.SiteContext);
  const puzzleCtx = useContext(Context.PuzzleContext);

  const renderPuzzle = Boolean(puzzleData?.link)
  const renderSheet = Boolean(puzzleData?.sheet_link);
  const renderPuzzleAndSheet = renderPuzzle && renderSheet;
  const renderOnlyPuzzle = renderPuzzle && !renderSheet;
  const renderOnlySheet = !renderPuzzle && renderSheet;
  const renderDiscord = Boolean(puzzleData?.discord_text_channel_id);

  const puzzlePane = (
    <div key='puzzle-pane' className='puzzle pane'>
      <iframe
        width="100%"
        height="100%"
        title={puzzleData?.name}
        src={puzzleData?.link}
      />
    </div>
  );

  const sheetPane = (
    <div key='sheet-pane' className='sheet pane'>
      <iframe
        width="100%"
        height="100%"
        title={puzzleData?.name}
        src={puzzleData?.sheet_link}
      />
    </div>
  );

  const leftPanes : {
    component: React.ReactNode,
    render: boolean,
    style,
  }[] = [
    {
      component: puzzlePane,
      render: renderPuzzle,
      style: renderOnlyPuzzle ? {height: '100%'} : renderOnlySheet ? {display: 'none'} : {},
    },
    {
      component: sheetPane,
      render: renderSheet,
      style: renderOnlySheet ? {height: '100%'} : renderOnlyPuzzle ? {display: 'none'} : {},
    },
  ];

  return (<>
    {(shouldRender || null) &&
    <ShowIf condition={isActive} className='hflex'>
      {puzzleData ?
        <div className='puzzle page'>
          <SplitPane
            split='vertical'
            primary='second'
            defaultSize={puzzleCtx.vsplitter?.value || 240}
            minSize={50}
            onDragFinished={puzzleCtx.vsplitter?.set}
          >
            <SplitPane
              split='horizontal'
              defaultSize={puzzleCtx.lhsplitter?.value || window.innerHeight / 2}
              onDragFinished={puzzleCtx.lhsplitter?.set}
              resizerClassName={renderPuzzleAndSheet ? 'Resizer' : 'nodisplay'}
              pane1Style={leftPanes[0].style}
              pane2Style={leftPanes[1].style}
            >
              {leftPanes.map(({component}) => component)}
            </SplitPane>
            <SplitPane
              split='horizontal'
              defaultSize={puzzleCtx.rhsplitter?.value || window.innerHeight / 2}
              onDragFinished={puzzleCtx.rhsplitter?.set}
            >
              <div className='puzzleinfo pane'>
              </div>
              <div className='chat pane'>
              </div>
            </SplitPane>
          </SplitPane>
        </div>
        :
        <p>The puzzle under /puzzles/{slug} does not exist. Maybe it was deleted?</p>
      }
    </ShowIf>
    }
  </>);
};

export default Puzzle;
