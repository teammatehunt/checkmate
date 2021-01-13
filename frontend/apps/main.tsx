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
import useSessionStorage from 'react-use/lib/useSessionStorage';

import Base from 'components/base';
import { Link } from 'components/drop-ins';
import { useLocalStorageObject, useDefaultLocalStorageObject } from 'utils/hooks';
import Master from 'components/master';
import MasterInfo from 'components/master-info';
import Puzzles from 'components/puzzle';
import PuzzleInfo from 'components/puzzle-info';
import {
  Columns,
  ExternalLink,
  Eye,
  EyeOff,
  Layout,
  MinusSquare,
  RefreshCw,
} from 'components/react-feather';
import TabBar from 'components/tabbar';
import {
  DiscordFrame,
  ShowIf,
  canonicalUrl,
  puzzleUrl,
} from 'components/frames';
import baseColors, { statuses as baseStatuses } from 'utils/colors';
import * as Model from 'utils/model';
import useActivityManager from 'utils/activity-manager';

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
  const [tabUuid] = useSessionStorage('main/tab-uuid', window.crypto.getRandomValues(new Uint32Array(1))[0]);

  const [tabs, setTabs] = useLocalStorage<string[]>('main/puzzle-tabs', []);
  const filteredTabs = tabs.filter(tab => tab in data.puzzles);
  const [cachedTabs, setCachedTabs] = useState<string[]>([]);
  const [cachedTabSet, setCachedTabSet] = useState<Set<string>>(new Set());
  const vsplitter = useDefaultLocalStorageObject<number>('frames/vsplitter', null);
  const rhsplitter = useDefaultLocalStorageObject<number>('frames/rhsplitter', null);

  // detect which rows are on screen
  const mainPaneChildRef = useRef(null);
  const [masterYDims, dispatchMasterYDims] = useReducer((state) => {
    const scrollTop = mainPaneChildRef.current.parentElement.scrollTop;
    const height = mainPaneChildRef.current.parentElement.getBoundingClientRect().height;
    const scrollHeight = mainPaneChildRef.current.parentElement.scrollHeight;
    const thresh = 0.1;
    if (state.scrollHeight === null ||
        Math.abs(scrollTop - state.scrollTop) >= thresh * height ||
        Math.abs((scrollTop + height) - (state.scrollTop + state.height)) >= thresh * height ||
        Math.abs(scrollHeight - state.scrollHeight) >= thresh * height) {
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
  useEffect(() => {
    if (slug === undefined) dispatchMasterYDims();
  }, [slug]);

  const hideSolved = useDefaultLocalStorageObject<boolean>('master/hide-solved', false);
  const editable = useDefaultLocalStorageObject<boolean>('master/editable', false);
  const sortNewRoundsFirst = useDefaultLocalStorageObject<boolean>('master/sort-new-rounds-first', false);
  const hideActivity = useDefaultLocalStorageObject<boolean>('main/hide-activity', false);
  const hideActivityRef = useRef(hideActivity.value);
  hideActivityRef.current = hideActivity.value;
  const disableDiscord = useDefaultLocalStorageObject<boolean>('main/disable-discord', false);
  const puzzleCacheSize = useDefaultLocalStorageObject<number>('frames/puzzle-cache-size', 3);

  // because tabs can update outside of this window
  const [maxVisibleTabs, setMaxVisibleTabs] = useState(null);

  const [extensionVersion, setExtensionVersion] = useState(undefined);

  // panes states / sidebar toggles
  const puzzleVisible = useDefaultLocalStorageObject<boolean>('frames/puzzle-visible', true);
  const sheetVisible = useDefaultLocalStorageObject<boolean>('frames/sheet-visible', true);
  const infoVisible = useDefaultLocalStorageObject<boolean>('frames/info-visible', true);
  const discordVisible = useDefaultLocalStorageObject<boolean>('frames/discord-visible', true);
  const discordInView = !disableDiscord.value && discordVisible.value;
  const puzzleSplitVertical = useDefaultLocalStorageObject<boolean>('frames/puzzle-split-vertical', false);
  const [reloadIfChangedTrigger, dispatchReloadIfChangedTrigger] = useReducer(state => state + 1, 0);
  const [reloadPuzzleTrigger, dispatchReloadPuzzleTrigger] = useReducer(state => state + 1, 0);
  const [reloadSheetTrigger, dispatchReloadSheetTrigger] = useReducer(state => state + 1, 0);

  const uid = data.uid;
  const hunt = data.hunt;
  const puzzles = data.puzzles;
  const puzzleData = puzzles[slug];

  const dataRef = useRef(data);
  const huntRef = useRef(hunt);
  const slugRef = useRef(slug);
  const iframeDetailsRef = useRef(iframeDetails);
  dataRef.current = data;
  huntRef.current = hunt;
  slugRef.current = slug;
  iframeDetailsRef.current = iframeDetails;
  const loadDiscord = useCallback((_slug, frameId?) => {
    // BigInt doesn't fit in JSON types
    const nullOrString = x => isBlank(x) ? null : x.toString();
    const puzzle = dataRef.current.puzzles[_slug];
    const round = dataRef.current.rounds[puzzle?.rounds?.[0]];
    const e = new CustomEvent('load-discord', {detail: {
      frameId: frameId ?? iframeDetailsRef.current.discord?.frameId,
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
  const loadSlug = useCallback((_slug, reset=false) => {
    if (reset || _slug !== slug) {
      const tabIndex = addTab(_slug);
      if (_slug === slug && _slug) {
        dispatchReloadIfChangedTrigger();
      } else {
        const url = isBlank(_slug) ? '/' : `/puzzles/${_slug}`;
        history.pushState({slug: _slug}, '', url);
        setSlug(_slug);
      }
      loadDiscord(_slug);
    }
  }, [slug, addTab]);

  useEffect(() => {
    if (slug) {
      document.title = puzzleData?.name ?? 'Checkmate';
    } else {
      document.title = 'Checkmate';
    }
  }, [slug]);

  // validate slug in tabs
  const initialLoadSlugInTabs = useRef(true);
  useEffect(() => {
    if (initialLoadSlugInTabs.current) {
      initialLoadSlugInTabs.current = false;
      return;
    }
    if (isBlank(slug)) return;
    if (!tabs.includes(slug)) loadSlug(undefined);
  }, [tabs, slug]);
  useEffect(() => {
    addTab(slug);
  }, [maxVisibleTabs]);
  useEffect(() => {
    if (tabs.some(slug => data.puzzles[slug]?.hidden !== false)) {
      setTabs(tabs.filter(slug => data.puzzles[slug]?.hidden === false));
    }
  }, [tabs, data]);
  useEffect(() => {
    const tabSet = new Set(tabs);
    const cacheSize = Number.isInteger(puzzleCacheSize.value) && puzzleCacheSize.value > 0 ? puzzleCacheSize.value : 3;
    if ((slug ?? undefined) === undefined || cachedTabs[0] === slug) {
      const filteredCachedTabs = cachedTabs.filter(tab => tabSet.has(tab)).slice(0, cacheSize);
      if (filteredCachedTabs.length !== cachedTabs.length) {
        setCachedTabs(filteredCachedTabs);
        setCachedTabSet(new Set(filteredCachedTabs));
      }
    } else {
      const filteredCachedTabs = [slug, ...cachedTabs.filter(tab => tab !== slug && tabSet.has(tab))].slice(0, cacheSize);
      setCachedTabs(filteredCachedTabs);
      setCachedTabSet(new Set(filteredCachedTabs));
    }
  }, [slug, tabs, cachedTabs, puzzleCacheSize.value]);

  const activateTab = useCallback((e) => {
    const href = e.currentTarget.getAttribute('href');
    const _slug = href.substring(href.lastIndexOf('/') + 1);
    loadSlug(_slug, _slug === slug);
  }, [slug, loadSlug]);

  const iframePuzzle = useMemo(() => {
    if ((slug ?? undefined) === undefined) return null;
    const currentUrl = iframeDetails[`puzzle/${slug}`]?.url;
    const canonicalCurrentUrl = currentUrl ? canonicalUrl(puzzleUrl(currentUrl, data.hunt?.root)) : null;
    let _slug = null;
    if (canonicalCurrentUrl) {
      for (const puzzle of Object.values(data.puzzles)) {
        if (puzzle.slug !== slug) {
          if (puzzle.link && canonicalUrl(puzzleUrl(puzzle.link, data.hunt?.root)) === canonicalCurrentUrl) {
            _slug = puzzle.slug;
            break;
          }
        }
      }
    }
    return _slug;
  }, [data, slug, iframeDetails]);

  const [activities, dispatchActivity] = useActivityManager();

  // connect to websocket for updates
  const socketRef = useRef(null);
  const reconnectDelayRef = useRef<number>(1);
  const updateCacheRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const sendActivity = useCallback((_slug=(slugRef.current ?? null)) => {
    if (!hideActivityRef.current && socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        activity: {
          puzzle: _slug,
          tab: tabUuid,
        },
        version: updateCacheRef.current?.version,
      }));
    }
  }, [tabUuid]);
  useEffect(() => {
    const closeWebsocket = () => {
      try {
        socketRef.current?.close();
      } catch (error) {}
    };
    const openWebsocket = (initial=false) => {
      const socket = new WebSocket(`wss://${window.location.host}/ws/`);
      socket.addEventListener('message', (e) => {
        const _data = JSONbig.parse(e.data);
        if (_data.data) {
          // update state data
          dataDispatch({
            ws: socket,
            cacheRef: updateCacheRef,
            update: _data,
          });
        }
        // update active users
        if (_data.activities) {
          dispatchActivity(_data.activities);
        }
      });
      socket.addEventListener('open', (e) => {
        setIsConnected(true);
        if (initial) sendActivity();
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
    openWebsocket(true);
    const interval = 60 * 1000; // one minute
    const intervalId = setInterval(sendActivity, interval);
    return () => {
      clearInterval(intervalId);
      if (!hideActivityRef.current) sendActivity(null);
      closeWebsocket();
    };
  }, []);
  const initialLoadSendActivityHide = useRef(true);
  useEffect(() => {
    if (initialLoadSendActivityHide.current) {
      initialLoadSendActivityHide.current = false;
      return;
    }
    if (hideActivity.value) {
      sendActivity(null);
    } else {
      sendActivity();
    }
  }, [hideActivity.value]);
  const initialLoadSendActivitySlug = useRef(true);
  useEffect(() => {
    if (initialLoadSendActivitySlug.current) {
      initialLoadSendActivitySlug.current = false;
      return;
    }
    // send activity when switching
    const delay = 5000; // ms
    setTimeout(_slug => {
      if (_slug === slugRef.current) sendActivity();
    }, delay, slug);
  }, [slug]);

  const [initialDiscordUrl] = useState(Model.discordLink(
    hunt?.discord_server_id, puzzleData?.discord_text_channel_id));

  const [resizingClass, setResizingClass] = useState('');
  const onDragStarted = useCallback(() => setResizingClass('resizing'), []);
  const onDragFinishedSet = useCallback((set) => (x) => {
    setResizingClass('');
    return set(x);
  }, []);
  const onDragFinishedVsplitter = onDragFinishedSet(vsplitter.set);
  const onDragFinishedRhsplitter = onDragFinishedSet(rhsplitter.set);

  const statuses = baseStatuses;
  const colors = useMemo(() => ({
    ...baseColors,
    ...hunt.tag_colors,
  }), [hunt.tag_colors]);

  const leftVisible = !(page === 'puzzle' && !puzzleVisible.value && !sheetVisible.value);
  const rightVisible = infoVisible.value || discordInView;

  return (
    <Base>
      <div className={`root vflex ${resizingClass} page-${page}`}>
        <TabBar
          tabs={filteredTabs}
          {...{
            slug,
            activateTab,
            setTabs,
            hunt,
            puzzles,
            uid,
            isConnected,
            maxVisibleTabs,
            setMaxVisibleTabs,
          }}
        />
        <div className='hflex'>
          {(page === 'puzzle' || null) &&
          <div className='sidebar left'>
            <span
              aria-label='Open puzzle externally'
              data-tip
              data-tip-delay
              data-place='below right'
            >
              <Link
                href={iframeDetailsRef.current?.[`puzzle/${slug}`]?.url}
                target='_blank'
                className='sidebar-icon nostyle'
              >
                <ExternalLink/>
              </Link>
            </span>
            <span
              aria-label='Reload puzzle'
              data-tip
              data-tip-delay
              data-place='below right'
            >
              <RefreshCw className='sidebar-icon' onClick={dispatchReloadPuzzleTrigger}/>
            </span>
            {puzzleVisible.value ?
              <span
                aria-label='Hide puzzle'
                data-tip
                data-tip-delay
                data-place='below right'
              >
                <Eye className='sidebar-icon' onClick={() => puzzleVisible.set(false)}/>
              </span>
              :
              <span
                aria-label='Show puzzle'
                data-tip
                data-tip-delay
                data-place='below right'
              >
                <EyeOff className='sidebar-icon' onClick={() => puzzleVisible.set(true)}/>
              </span>
            }
            {puzzleSplitVertical.value ?
              <span
                aria-label='Change to horizontal split'
                data-tip
                data-tip-delay
                data-place='below right'
              >
                <Columns className='sidebar-icon' onClick={() => puzzleSplitVertical.set(false)}/>
              </span>
              :
              <span
                aria-label='Change to vertical split'
                data-tip
                data-tip-delay
                data-place='below right'
              >
                <MinusSquare className='sidebar-icon' onClick={() => puzzleSplitVertical.set(true)}/>
              </span>
            }
            <span
              aria-label='Open Checkmate tab for currently navigated puzzle page'
              data-tip
              data-tip-delay
              data-place='below right'
            >
              <Layout className={`sidebar-icon ${iframePuzzle ? 'enabled' : 'disabled'}`} onClick={iframePuzzle ? () => loadSlug(iframePuzzle) : undefined}/>
            </span>
            <div className='text-up'>Puzzle</div>
            <div className='flex'/>
            <span
              aria-label='Open Sheets externally'
              data-tip
              data-tip-delay
              data-place='below right'
            >
              <Link
                href={iframeDetailsRef.current?.[`sheet/${slug}`]?.url}
                target='_blank'
                className='sidebar-icon nostyle'
              >
                <ExternalLink/>
              </Link>
            </span>
            <span
              aria-label='Reload Sheets'
              data-tip
              data-tip-delay
              data-place='below right'
            >
              <RefreshCw className='sidebar-icon' onClick={dispatchReloadSheetTrigger}/>
            </span>
            {sheetVisible.value ?
              <span
                aria-label='Hide Sheets'
                data-tip
                data-tip-delay
                data-place='below right'
              >
                <Eye className='sidebar-icon' onClick={() => sheetVisible.set(false)}/>
              </span>
              :
              <span
                aria-label='Show Sheets'
                data-tip
                data-tip-delay
                data-place='below right'
              >
                <EyeOff className='sidebar-icon' onClick={() => sheetVisible.set(true)}/>
              </span>
            }
            <div className='text-up'>Sheet</div>
          </div>
          }
          <div className='flex'>
            <SplitPane
              split='vertical'
              primary='second'
              defaultSize={vsplitter.value || 360}
              minSize={50}
              maxSize={-50}
              onDragStarted={onDragStarted}
              onDragFinished={onDragFinishedVsplitter}
              resizerClassName={leftVisible && rightVisible ? 'Resizer' : 'nodisplay'}
              pane1Style={rightVisible ? undefined : {width: '100%'}}
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
                    activities={activities}
                    hideSolved={hideSolved.value}
                    editable={editable.value}
                    sortNewRoundsFirst={sortNewRoundsFirst.value}
                    yDims={masterYDims}
                  />
                </ShowIf>
                <ShowIf display={page === 'puzzle'}>
                  <Puzzles
                    isActive={page === 'puzzle'}
                    tabs={filteredTabs}
                    puzzleVisible={puzzleVisible.value}
                    sheetVisible={sheetVisible.value}
                    puzzleSplitVertical={puzzleSplitVertical.value}
                    {...{
                      slug,
                      puzzles,
                      hunt,
                      iframeDetails,
                      onDragStarted,
                      onDragFinishedSet,
                      reloadIfChangedTrigger,
                      reloadPuzzleTrigger,
                      reloadSheetTrigger,
                      cachedTabSet,
                    }}
                  />
                </ShowIf>
              </div>
              <SplitPane
                split='horizontal'
                defaultSize={rhsplitter.value || window.innerHeight / 2}
                minSize={50}
                maxSize={-50}
                onDragStarted={onDragStarted}
                onDragFinished={onDragFinishedRhsplitter}
                resizerClassName={infoVisible.value && discordInView ? 'Resizer' : 'nodisplay'}
                pane1Style={discordInView ? undefined : {height: '100%'}}
                pane2Style={infoVisible.value ? undefined : {height: '100%'}}
                /* @ts-ignore */
                pane1ClassName={infoVisible.value ? '' : 'nodisplay'}
                pane2ClassName={discordInView ? '' : 'nodisplay'}
              >
                <div className={`${page}info infopane pane`}>
                  <ShowIf display={page === 'master'}>
                    <MasterInfo
                      data={data}
                      hideSolved={hideSolved}
                      editable={editable}
                      sortNewRoundsFirst={sortNewRoundsFirst}
                      puzzleCacheSize={puzzleCacheSize}
                      hideActivity={hideActivity}
                      disableDiscord={disableDiscord}
                    />
                  </ShowIf>
                  <ShowIf display={page === 'puzzle'}>
                    <PuzzleInfo
                      data={data}
                      slug={slug}
                      loadSlug={loadSlug}
                      statuses={statuses}
                      colors={colors}
                      puzzleActivities={activities[slug]}
                    />
                  </ShowIf>
                </div>
                <div className='chat pane'>
                  <DiscordFrame
                    id='discord'
                    src={initialDiscordUrl}
                    hasExtension={Boolean(extensionVersion)}
                    disabled={disableDiscord.value}
                  />
                </div>
              </SplitPane>
            </SplitPane>
          </div>
          <div className='sidebar right'>
            {infoVisible.value ?
              <span
                aria-label='Hide information'
                data-tip
                data-tip-delay
                data-place='below left'
              >
                <Eye className='sidebar-icon' onClick={() => infoVisible.set(false)}/>
              </span>
              :
              <span
                aria-label='Show information'
                data-tip
                data-tip-delay
                data-place='below left'
              >
                <EyeOff className='sidebar-icon' onClick={() => infoVisible.set(true)}/>
              </span>
            }
            <div className='text-down'>Info</div>
            <div className='flex'/>
            {(!disableDiscord.value || null) &&
            <>
              <span
                aria-label='Open Discord externally'
                data-tip
                data-tip-delay
                data-place='below left'
              >
                <Link
                  href={iframeDetailsRef.current?.['discord']?.url}
                  target='_blank'
                  className='sidebar-icon nostyle'
                >
                  <ExternalLink/>
                </Link>
              </span>
              <span
                aria-label='Reload Discord'
                data-tip
                data-tip-delay
                data-place='below left'
              >
                <RefreshCw className='sidebar-icon' onClick={() => loadDiscord(slug)}/>
              </span>
              {discordVisible.value ?
                <span
                  aria-label='Hide Discord'
                  data-tip
                  data-tip-delay
                  data-place='below left'
                >
                  <Eye className='sidebar-icon' onClick={() => discordVisible.set(false)}/>
                </span>
                :
                <span
                  aria-label='Show Discord'
                  data-tip
                  data-tip-delay
                  data-place='below left'
                >
                  <EyeOff className='sidebar-icon' onClick={() => discordVisible.set(true)}/>
                </span>
              }
              <div className='text-down'>Discord</div>
            </>
            }
          </div>
        </div>
      </div>
    </Base>
  );
};

export default mountElement(Main);
