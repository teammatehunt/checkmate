import mountElement from 'utils/mount';
import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
} from 'react';

import produce from 'immer';
import { useLocalStorage } from '@rehooks/local-storage';
import SplitPane from 'react-split-pane';

import * as Model from 'components/model';
import Base from 'components/base';
import Master from 'components/master';
import Puzzles from 'components/puzzle';
import Header from 'components/tabbar';
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
  const [slug, setSlug] = useState(props.page === 'puzzle' ? props.slug : undefined);
  const page = slug === undefined ? 'master' : 'puzzle';
  const [data, dataDispatch] = useReducer(Model.dataReducer, props.data);
  const iframeUrlsReducer = (state, action) => Object.assign({}, state, action);
  const [iframeUrls, iframeUrlsDispatch] = useReducer(iframeUrlsReducer, {});

  const [tabs, setTabs] = useLocalStorage<string[]>('main/puzzle-tabs', []);
  const [vsplitter, setVsplitter] = useLocalStorage<number>('frames/vsplitter', null);
  const [rhsplitter, setRhsplitter] = useLocalStorage<number>('frames/rhsplitter', null);

  const uid = data.uid;
  const siteCtx = data.hunt;
  const puzzles = data.puzzles;
  const puzzleData = puzzles[slug];

  useEffect(() => {
    const handler = (e) => setSlug(e.state.slug);
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);
  // custom event for listening to url changes in iframes
  useEffect(() => {
    const handler = (e) => {
      iframeUrlsDispatch({[e.detail.name]: e.detail.url});
    }
    window.addEventListener('loaded-subframe', handler);
    return () => window.removeEventListener('loaded-subframe', handler);
  }, []);

  const loadSlug = _slug => {
    if (_slug !== undefined && !tabs.includes(_slug)) {
      setTabs([_slug, ...tabs]);
    }
    if (_slug !== slug) {
      setSlug(_slug);
      const url = _slug === undefined ? '/' : `/puzzles/${_slug}`;
      history.pushState({slug: _slug}, '', url);
    }
  };

  useEffect(() => {
    if (page === 'puzzle') {
      if (slug in puzzles && !tabs.includes(slug)) {
        setTabs([slug, ...tabs]);
      }
    }
  }, [slug]);
  const activateTab = loadSlug;
  const removeTab = (_slug) => {
    const index = tabs.indexOf(_slug);
    if (index !== -1) {
      const newTabs = tabs.filter(x => x !== _slug);
      setTabs(newTabs);
      if (_slug === slug) {
        const newIndex = Math.min(index, newTabs.length - 1);
        const newSlug = newTabs[newIndex];
        loadSlug(newSlug);
      }
    }
  }

  const [initialDiscordUrl] = useState(Model.discordLink(
    siteCtx?.discord_server_id, puzzleData?.discord_text_channel_id));

  const [resizingClass, setResizingClass] = useState('');
  const onDragStarted = () => setResizingClass('resizing');
  const onDragFinishedSet = (set) => (x) => {
    setResizingClass('');
    return set(x);
  };

  return (
    <Base>
      <div className={`root vflex ${resizingClass}`}>
        <Header {...{
          tabs,
          slug,
          activateTab,
          removeTab,
          siteCtx,
          puzzles,
          uid,
        }}/>
        <div className='flex'>
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
                  isActive={page === 'puzzle'}
                  tabs={tabs}
                  slug={slug}
                  puzzles={puzzles}
                  siteCtx={siteCtx}
                  iframeUrls={iframeUrls}
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
                  id="discord"
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
