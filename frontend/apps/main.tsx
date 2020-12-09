import mountElement from 'utils/mount';
import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
} from 'react';

import { useLocalStorage } from '@rehooks/local-storage';
import SplitPane from 'react-split-pane';

import * as Model from 'components/model';
import Base from 'components/base';
import Master from 'components/master';
import Puzzles from 'components/puzzle';
import {
  ShowIf,
  DiscordFrame,
} from 'components/frames';

import 'style/layout.css';
import 'style/split-pane.css';

interface MainProps {
  page: 'master' | 'puzzle';
  data: Model.Data;
  slug?: string;
}

export const Main : React.FC<MainProps> = props => {
  const [page, setPage] = useState(props.page);
  const [slug, setSlug] = useState(props.slug);
  const [data, dataDispatch] = useReducer(Model.dataReducer, props.data);

  const [tabs, setTabs, deleteTabs] = useLocalStorage<string[]>('main/puzzle-tabs', []);
  const [vsplitter, setVsplitter] = useLocalStorage<number>('frames/vsplitter', null);
  const [rhsplitter, setRhsplitter] = useLocalStorage<number>('frames/rhsplitter', null);

  const siteCtx = data.hunt;
  const puzzleData = data.puzzles[slug];
  const [initialDiscordUrl] = useState(Model.discordLink(
    siteCtx?.discord_server_id, puzzleData?.discord_text_channel_id));

  useEffect(() => {
    if (page === 'puzzle') {
      if (slug in data.puzzles && !tabs.includes(slug)) {
        setTabs([slug, ...tabs]);
      }
    }
  }, [slug]);

  const [resizingClass, setResizingClass] = useState('');
  const onDragStarted = () => setResizingClass('resizing');
  const onDragFinishedSet = (set) => (x) => {
    setResizingClass('');
    return set(x);
  };

  return (
    <Base>
      <div className={`root vflex ${resizingClass}`}>
        <h1>Main Page</h1>
        <div className="flex">
          <SplitPane
            split='vertical'
            primary='second'
            defaultSize={vsplitter || 240}
            minSize={50}
            onDragStarted={onDragStarted}
            onDragFinished={onDragFinishedSet(setVsplitter)}
          >
            <div>
              <ShowIf display={page === 'master'}>
                <Master
                  isActive={page === 'master'}
                  data={data}
                />
              </ShowIf>
              <ShowIf display={page === 'puzzle'}>
                <Puzzles
                  tabs={tabs}
                  slug={slug}
                  puzzles={data.puzzles}
                  siteCtx={siteCtx}
                  isActive={page === 'puzzle'}
                  onDragStarted={onDragStarted}
                  onDragFinishedSet={onDragFinishedSet}
                />
              </ShowIf>
            </div>
            <SplitPane
              split='horizontal'
              defaultSize={rhsplitter || window.innerHeight / 2}
              onDragStarted={onDragStarted}
              onDragFinished={onDragFinishedSet(setRhsplitter)}
            >
              <div className='puzzleinfo pane'>
              </div>
              <div className='chat pane'>
                <DiscordFrame
                  src={initialDiscordUrl}
                />
              </div>
            </SplitPane>
          </SplitPane>
        </div>
      </div>
    </Base>
  );
};

export default mountElement(Main);
