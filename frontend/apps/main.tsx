import mountElement from 'utils/mount';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import * as JSONbig from 'json-bigint';
import { useLocalStorage } from '@rehooks/local-storage';
import SplitPane from 'react-split-pane';

import Base from 'components/base';
import { Link } from 'components/drop-ins';
import { useLocalStorageObject } from 'utils/hooks';
import Master from 'components/master';
import MasterInfo from 'components/master-info';
import Puzzles from 'components/puzzle';
import PuzzleInfo from 'components/puzzle-info';
import {
  ExternalLink,
  Eye,
  EyeOff,
} from 'components/react-feather';
import TabBar from 'components/tabbar';
import {
  DiscordFrame,
  ShowIf,
} from 'components/frames';
import baseColors, { statuses as baseStatuses } from 'utils/colors';
import * as Model from 'utils/model';

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

  // detect which rows are on screen
  const mainPaneChildRef = useRef(null);
  const [masterYDims, dispatchMasterYDims] = useReducer((state, action) => {
    const scrollTop = mainPaneChildRef.current.parentElement.scrollTop;
    const height = mainPaneChildRef.current.parentElement.getBoundingClientRect().height;
    const scrollHeight = mainPaneChildRef.current.parentElement.scrollHeight;
    const thresh = 0.1;
    if (state.scrollHeight === null ||
        Math.abs(scrollTop - state.scrollTop) >= thresh * height ||
        Math.abs((scrollTop + height) - (state.scrollTop + state.height)) >= thresh * height) {
      return {scrollTop, height, scrollHeight};
    } else {
      return state;
    }
  },
  {
    scrollTop: 0,
    height: document.body.getBoundingClientRect().height,
    scrollHeight: null,
  });
  useEffect(() => {
    const handler = () => {
      window.requestAnimationFrame(dispatchMasterYDims);
    }
    mainPaneChildRef.current.parentElement.addEventListener('scroll', handler, {passive: true});
    window.addEventListener('resize', handler, {passive: true});
    handler();
    return () => {
      mainPaneChildRef.current.parentElement.removeEventListener('scroll', handler);
      window.removeEventListener('resize', handler);
    };
  }, []);

  const hideSolved = useLocalStorageObject<boolean>('master/hide-solved', false);

  // because tabs can update outside of this window
  const initialLoad = useRef(true);
  const [maxVisibleTabs, setMaxVisibleTabs] = useState(null);

  const [extensionVersion, setExtensionVersion] = useState(undefined);

  // panes states / sidebar toggles
  const [puzzleVisible, setPuzzleVisible] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(true);
  const [infoVisible, setInfoVisible] = useState(true);
  const [discordVisible, setDiscordVisible] = useState(true);

  const uid = data.uid;
  const hunt = data.hunt;
  const puzzles = data.puzzles;
  const puzzleData = puzzles[slug];

  const dataRef = useRef(data);
  const huntRef = useRef(hunt);
  const iframeDetailsRef = useRef(iframeDetails);
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { huntRef.current = hunt; }, [hunt]);
  useEffect(() => { iframeDetailsRef.current = iframeDetails; }, [iframeDetails]);
  const loadDiscord = useCallback((_slug, frameId) => {
    // BigInt doesn't fit in JSON types
    const nullOrString = x => isBlank(x) ? null : x.toString();
    const puzzle = dataRef.current.puzzles[_slug];
    const round = dataRef.current.rounds[puzzle?.rounds?.[0]];
    const e = new CustomEvent('load-discord', {detail: {
      frameId: frameId,
      serverId: nullOrString(huntRef.current.discord_server_id),
      categoryId: nullOrString(round?.discord_category_id),
      voiceChannelId: nullOrString(puzzle?.discord_voice_channel_id),
      textChannelId: nullOrString(puzzle?.discord_text_channel_id),
    }});
    window.dispatchEvent(e);
  }, []);

  // Check for extension
  useEffect(() => {
    const handler = (e) => setExtensionVersion(e.detail?.version);
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
      if (e.detail.name === 'discord' && !('discord' in iframeDetailsRef.current)) {
        loadDiscord(slug, e.detail.frameId);
      }
      iframeDetailsDispatch({[e.detail.name]: e.detail});
    }
    window.addEventListener('loaded-subframe', handler);
    return () => window.removeEventListener('loaded-subframe', handler);
  }, []);

  const addTab = useCallback(_slug => {
    if (dataRef.current.puzzles[_slug]?.hidden === false) {
      const tabIndex = tabs.indexOf(_slug);
      if (tabIndex === -1) {
        setTabs([_slug, ...tabs]);
        return 0;
      } else if (maxVisibleTabs > 0 && tabIndex >= maxVisibleTabs) {
        setTabs([...tabs.slice(0, maxVisibleTabs - 1), _slug, ...tabs.slice(maxVisibleTabs - 1, tabIndex), ...tabs.slice(tabIndex + 1)]);
        return maxVisibleTabs - 1;
      } else {
        return tabIndex;
      }
    }
    return null;
  }, [tabs, maxVisibleTabs]);
  const loadSlug = useCallback(_slug => {
    if (_slug !== slug) {
      const tabIndex = addTab(_slug);
      setSlug(_slug);
      const url = isBlank(_slug) ? '/' : `/puzzles/${_slug}`;
      history.pushState({slug: _slug}, '', url);
      loadDiscord(_slug, iframeDetailsRef.current.discord?.frameId);
    }
  }, [slug, addTab]);

  useEffect(() => {
    if (slug) {
      document.title = puzzleData?.name ?? 'Checkmate';
    } else {
      document.title = 'Master';
    }
  }, [slug]);

  // validate slug in tabs
  useEffect(() => {
    if (initialLoad.current) return;
    if (isBlank(slug)) return;
    if (!tabs.includes(slug)) loadSlug(undefined);
  }, [tabs, slug]);
  useEffect(() => {
    addTab(slug);
    initialLoad.current = false;
  }, [maxVisibleTabs]);
  useEffect(() => {
    if (tabs.some(slug => data.puzzles[slug]?.hidden !== false)) {
      setTabs(tabs.filter(slug => data.puzzles[slug]?.hidden === false));
    }
  }, [tabs, data]);

  const activateTab = useCallback((e) => {
    const href = e.currentTarget.getAttribute('href');
    const _slug = href.substring(href.lastIndexOf('/') + 1);
    loadSlug(_slug);
  }, [loadSlug]);

  // connect to websocket for updates
  const socketRef = useRef(null);
  const reconnectDelayRef = useRef<number>(1);
  const updateCacheRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  useEffect(() => {
    const closeWebsocket = () => {
      try {
        socketRef.current.close();
      } catch (error) {}
    };
    const openWebsocket = () => {
      const socket = new WebSocket(`wss://${window.location.host}/ws/`);
      socket.addEventListener('message', (e) => {
        const _data = JSONbig.parse(e.data);
        dataDispatch({
          ws: socket,
          cacheRef: updateCacheRef,
          update: _data,
        });
      });
      socket.addEventListener('open', (e) => {
        setIsConnected(true);
        reconnectDelayRef.current = 1;
      });
      socket.addEventListener('close', (e) => {
        setIsConnected(false);
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
    hunt?.discord_server_id, puzzleData?.discord_text_channel_id));

  const [resizingClass, setResizingClass] = useState('');
  const onDragStarted = useCallback(() => setResizingClass('resizing'), []);
  const onDragFinishedSet = useCallback((set) => (x) => {
    setResizingClass('');
    return set(x);
  }, []);
  const onDragFinishedVsplitter = onDragFinishedSet(setVsplitter);
  const onDragFinishedRhsplitter = onDragFinishedSet(setRhsplitter);

  const statuses = baseStatuses;
  const colors = useMemo(() => ({
    ...baseColors,
    ...hunt.tag_colors,
  }), [hunt.tag_colors]);

  const leftVisible = !(page === 'puzzle' && !puzzleVisible && !sheetVisible);
  const rightVisible = infoVisible || discordVisible;

  return (
    <Base>
      <div className={`root vflex ${resizingClass} page-${page}`}>
        <TabBar {...{
          tabs,
          slug,
          activateTab,
          setTabs,
          hunt,
          puzzles,
          uid,
          isConnected,
          maxVisibleTabs,
          setMaxVisibleTabs,
        }}/>
        <div className='hflex'>
          <div className='sidebar left'>
            {(page === 'puzzle' || null) &&
            <>
              <a
                href={iframeDetailsRef.current?.[`puzzle/${slug}`]?.url}
                target='_blank'
              >
                <ExternalLink/>
              </a>
              {puzzleVisible ?
                <Eye onClick={() => setPuzzleVisible(false)}/>
                :
                <EyeOff onClick={() => setPuzzleVisible(true)}/>
              }
              <div className='text-up'>Puzzle</div>
              <div className='flex'/>
              <a
                href={iframeDetailsRef.current?.[`sheet/${slug}`]?.url}
                target='_blank'
              >
                <ExternalLink/>
              </a>
              {sheetVisible ?
                <Eye onClick={() => setSheetVisible(false)}/>
                :
                <EyeOff onClick={() => setSheetVisible(true)}/>
              }
              <div className='text-up'>Sheet</div>
            </>
            }
          </div>
          <div className='flex'>
            <SplitPane
              split='vertical'
              primary='second'
              defaultSize={vsplitter || 240}
              minSize={50}
              onDragStarted={onDragStarted}
              onDragFinished={onDragFinishedVsplitter}
              resizerClassName={leftVisible && rightVisible ? 'Resizer' : 'nodisplay'}
              /* only for pane2 because pane2 is primary */
              pane2Style={leftVisible ? undefined : {width: '100%'}}
              /* @ts-ignore */
              pane1ClassName={leftVisible ? '' : 'nodisplay'}
              pane2ClassName={rightVisible ? '' : 'nodisplay'}
            >
              <div ref={mainPaneChildRef}>
                <ShowIf display={page === 'master'}>
                  <Master
                    isActive={page === 'master'}
                    data={data}
                    loadSlug={loadSlug}
                    statuses={statuses}
                    colors={colors}
                    hideSolved={hideSolved.value}
                    yDims={masterYDims}
                  />
                </ShowIf>
                <ShowIf display={page === 'puzzle'}>
                  <Puzzles
                    isActive={page === 'puzzle'}
                    tabs={tabs}
                    slug={slug}
                    puzzles={puzzles}
                    hunt={hunt}
                    iframeDetails={iframeDetails}
                    onDragStarted={onDragStarted}
                    onDragFinishedSet={onDragFinishedSet}
                    puzzleVisible={puzzleVisible}
                    sheetVisible={sheetVisible}
                  />
                </ShowIf>
              </div>
              <SplitPane
                split='horizontal'
                defaultSize={rhsplitter || window.innerHeight / 2}
                onDragStarted={onDragStarted}
                onDragFinished={onDragFinishedRhsplitter}
                resizerClassName={infoVisible && discordVisible ? 'Resizer' : 'nodisplay'}
                /* @ts-ignore */
                pane1ClassName={infoVisible ? '' : 'nodisplay'}
                pane2ClassName={discordVisible ? '' : 'nodisplay'}
              >
                <div className={`${page}info infopane pane`}>
                  <ShowIf display={page === 'master'}>
                    <MasterInfo
                      data={data}
                      hideSolved={hideSolved}
                    />
                  </ShowIf>
                  <ShowIf display={page === 'puzzle'}>
                    <PuzzleInfo
                      data={data}
                      slug={slug}
                      loadSlug={loadSlug}
                      statuses={statuses}
                      colors={colors}
                    />
                  </ShowIf>
                </div>
                <div className='chat pane'>
                  <DiscordFrame
                    id='discord'
                    src={initialDiscordUrl}
                    hasExtension={Boolean(extensionVersion)}
                  />
                </div>
              </SplitPane>
            </SplitPane>
          </div>
          <div className='sidebar right'>
            {infoVisible ?
              <Eye onClick={() => setInfoVisible(false)}/>
              :
              <EyeOff onClick={() => setInfoVisible(true)}/>
            }
            <div className='text-down'>Info</div>
            <div className='flex'/>
            <a
              href={iframeDetailsRef.current?.['discord']?.url}
              target='_blank'
            >
              <ExternalLink/>
            </a>
            {discordVisible ?
              <Eye onClick={() => setDiscordVisible(false)}/>
              :
              <EyeOff onClick={() => setDiscordVisible(true)}/>
            }
            <div className='text-down'>Discord</div>
          </div>
        </div>
      </div>
    </Base>
  );
};

export default mountElement(Main);
