import mountElement from 'utils/mount';
import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';

import * as JSONbig from 'json-bigint';
import produce from 'immer';
import { useLocalStorage } from '@rehooks/local-storage';
import SplitPane from 'react-split-pane';

import * as Model from 'utils/model';
import Base from 'components/base';
import Master from 'components/master';
import Puzzles from 'components/puzzle';
import PuzzleInfo from 'components/puzzle-info';
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

const isBlank = x => x === undefined || x === null;

export const Main : React.FC<MainProps> = props => {
  const [slug, setSlug] = useState(props.page === 'puzzle' ? props.slug : undefined);
  const page = isBlank(slug) ? 'master' : 'puzzle';
  const [data, dataDispatch] = useReducer(Model.dataReducer, props.data);
  const iframeDetailsReducer = (state, action) => Object.assign({}, state, action);
  const [iframeDetails, iframeDetailsDispatch] = useReducer(iframeDetailsReducer, {});


  const [tabs, setTabs] = useLocalStorage<string[]>('main/puzzle-tabs', []);
  const [vsplitter, setVsplitter] = useLocalStorage<number>('frames/vsplitter', null);
  const [rhsplitter, setRhsplitter] = useLocalStorage<number>('frames/rhsplitter', null);

  // because tabs can update outside of this window
  const [tabIndex, setTabIndex] = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);

  const [hasExtension, setHasExtension] = useState(false);

  const uid = data.uid;
  const siteCtx = data.hunt;
  const puzzles = data.puzzles;
  const puzzleData = puzzles[slug];

  const loadDiscord = (_slug, frameId) => {
    // BigInt doesn't fit in JSON types
    const nullOrString = x => isBlank(x) ? null : x.toString();
    const e = new CustomEvent('load-discord', {detail: {
      frameId: frameId,
      serverId: nullOrString(siteCtx.discord_server_id),
      voiceChannelId: nullOrString(puzzles[_slug]?.discord_voice_channel_id),
      textChannelId: nullOrString(puzzles[_slug]?.discord_text_channel_id),
    }});
    window.dispatchEvent(e);
  };

  // Check for extension
  useEffect(() => {
    const handler = (e) => setHasExtension(true);
    window.addEventListener('pong', handler);
    window.dispatchEvent(new Event('ping'));
    return () => window.removeEventListener('pong', handler);
  }, []);
  // Reload history
  useEffect(() => {
    const handler = (e) => setSlug(e.state.slug);
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);
  // custom event for listening to url changes in iframes
  useEffect(() => {
    const handler = (e) => {
      if (e.detail.name === 'discord' && !('discord' in iframeDetails)) {
        loadDiscord(slug, e.detail.frameId);
      }
      iframeDetailsDispatch({[e.detail.name]: e.detail});
    }
    window.addEventListener('loaded-subframe', handler);
    return () => window.removeEventListener('loaded-subframe', handler);
  }, []);

  const addTab = _slug => {
    if (page === 'puzzle') {
      if (_slug !== undefined && _slug in puzzles) {
        const _tabIndex = tabs.indexOf(_slug);
        if (_tabIndex === -1) {
          setTabs([_slug, ...tabs]);
          return 0;
        } else {
          return _tabIndex;
        }
      }
    }
    return null;
  }
  const loadSlug = _slug => {
    if (_slug !== slug) {
      const _tabIndex = addTab(_slug);
      setSlug(_slug);
      setTabIndex(_tabIndex);
      const url = isBlank(_slug) ? '/' : `/puzzles/${_slug}`;
      history.pushState({slug: _slug}, '', url);
      if (_slug !== undefined) loadDiscord(_slug, iframeDetails.discord?.frameId);
    }
  };

  // validate slug in tabs
  useEffect(() => {
    if (initialLoad) return;
    if (isBlank(slug)) return;
    const _tabIndex = tabs.indexOf(slug);
    if (_tabIndex === -1) {
      const newIndex = Math.min(tabIndex, tabs.length - 1);
      const newSlug = tabs[newIndex];
      loadSlug(newSlug);
    }
  }, [tabs, slug]);
  useEffect(() => {
    addTab(slug);
    setInitialLoad(false);
  }, []);

  const activateTab = loadSlug;
  const removeTab = (_slug) => {
    if (tabs.includes(_slug)) {
      const newTabs = tabs.filter(x => x !== _slug);
      setTabs(newTabs);
    }
  }

  // connect to websocket for updates
  const socketRef = useRef(null);
  const reconnectDelayRef = useRef<number>(1);
  const updateCacheRef = useRef(null);
  useEffect(() => {
    const closeWebsocket = () => {
      try {
        socketRef.current.close();
      } catch (error) {}
    };
    const openWebsocket = () => {
      const socket = new WebSocket(`ws://${window.location.host}/ws/`);
      socket.addEventListener('message', (e) => {
        const data = JSONbig.parse(e.data);
        dataDispatch({
          ws: socket,
          cacheRef: updateCacheRef,
          update: data,
        });
      });
      socket.addEventListener('open', (e) => {
        reconnectDelayRef.current = 1;
      });
      socket.addEventListener('close', (e) => {
        setTimeout(openWebsocket, reconnectDelayRef.current * 1000);
        reconnectDelayRef.current += 1;
      });
      closeWebsocket();
      socketRef.current = socket;
    };
    openWebsocket();
    return closeWebsocket;
  }, []);

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
                  iframeDetails={iframeDetails}
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
                <PuzzleInfo data={data} slug={slug} loadSlug={loadSlug}/>
              </div>
              <div className='chat pane'>
                <DiscordFrame
                  id='discord'
                  src={initialDiscordUrl}
                  hasExtension={hasExtension}
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
