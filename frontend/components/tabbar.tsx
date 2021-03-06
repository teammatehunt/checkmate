import React, {
  useCallback,
  useEffect,
  useReducer,
  useRef,
} from 'react';

import {
  Link,
} from 'components/drop-ins';
import {
  Compass,
  Layout,
  LogOut,
  Menu,
  MoreHorizontal,
  Tool,
  X,
} from 'components/react-feather';
import Twemoji from 'components/twemoji';
import { LocalStorageObject } from 'utils/hooks';
import * as Model from 'utils/model';

import Icon from 'assets/icon.svg';

import 'style/tabbar.css';

const NavHome = ({slug, activateTab}) => {
  const isActive = slug === undefined;
  return (
    <Link
      href='/'
      className='nav-item-link nostyle'
      load={activateTab}
    >
      <div
        className={`logo nav-item ${isActive ? 'active' : ''}`}
      >
        <Icon className='icon'/>
        <span className='logo-text'>Checkmate</span>
      </div>
    </Link>
  );
};

interface TabProps {
  tab: string;
  isActive: boolean;
  activateTab: any;
  removeTab: any;
  puzzleData: Model.Puzzle;
  className: string;
}

const Tab = ({
  tab,
  isActive,
  activateTab,
  removeTab,
  puzzleData,
  className,
}) => {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    const onAuxClick = (e) => {
      if (e.button === 1) {
        // middle click
        e.preventDefault();
        removeTab(e);
      }
    };
    element.addEventListener('auxclick', onAuxClick, {capture: true});
    return () => element.removeEventListener('auxclick', onAuxClick, {capture: true});
  }, [removeTab]);

  return (
    <div
      className={`tab-container ${className} ${Model.isSolved(puzzleData) ? 'solved' : ''}`}
      data-tab={tab}
      ref={ref}
    >
      <Link
        key={tab}
        href={`/puzzles/${tab}`}
        className='nostyle'
        load={activateTab}
      >
        <div className={`tab ${className} ${isActive ? 'active' : ''}`}>
          <div className={`tab-content ${className}`}>
            <Twemoji>
              {puzzleData.name}
            </Twemoji>
          </div>
        </div>
      </Link>
      <div
        className={`tab-remove ${className}`}
        data-tab={tab}
        onClick={removeTab}
      >
        <X/>
      </div>
    </div>
  );
}

const NavSettings = ({
  removeSolvedTabs,
  removeAllTabs,
  resetPanes,
}) => (
  <div className='nav-item nav-settings'>
    <Menu className='nav-menu'/>
    <div className='nav-settings-dropdown'>
      <Link className='nav-item-link nostyle' onClick={removeSolvedTabs}>
        <div>
          <X/>
          <span>Close solved tabs</span>
        </div>
      </Link>
      <Link className='nav-item-link nostyle' onClick={removeAllTabs}>
        <div>
          <X/>
          <span>Close all tabs</span>
        </div>
      </Link>
      <Link className='nav-item-link nostyle' onClick={resetPanes}>
        <div>
          <Layout/>
          <span>Reset pane sizes</span>
        </div>
      </Link>
      <Link
        href='/getting-started'
        className='nav-item-link nostyle'
        target='_blank'
      >
        <div>
          <Compass/>
          <span>Getting started</span>
        </div>
      </Link>
      <Link
        href='/extension'
        className='nav-item-link nostyle'
        target='_blank'
      >
        <div>
          <Tool/>
          <span>Extension instructions</span>
        </div>
      </Link>
      <Link
        href='/accounts/logout'
        className='nav-item-link nostyle'
      >
        <div>
          <LogOut/>
          <span>Logout</span>
        </div>
      </Link>
    </div>
  </div>
);

interface TabBarProps {
  tabs: string[];
  slug: string;
  activateTab: any;
  setTabs: any;
  puzzles: Model.Puzzles;
  uid: number;
  isConnected: boolean;
  maxVisibleTabs: number;
  setMaxVisibleTabs: any;
  vsplitter: LocalStorageObject<number>;
  rhsplitter: LocalStorageObject<number>;
  lsplitter: LocalStorageObject<number>;
  setResetSplits: any;
}

const TabBar : React.FC<TabBarProps> = ({
  tabs,
  slug,
  activateTab,
  setTabs,
  puzzles,
  uid,
  isConnected,
  maxVisibleTabs,
  setMaxVisibleTabs,
  vsplitter,
  rhsplitter,
  lsplitter,
  setResetSplits,
}) => {
  const removeTab = useCallback((e) => {
    const _slug = e.currentTarget.getAttribute('data-tab');
    if (tabs.includes(_slug)) {
      const newTabs = tabs.filter(x => x !== _slug);
      setTabs(newTabs);
    }
  }, [tabs, setTabs]);

  const removeSolvedTabs = useCallback(() => {
    setTabs(tabs.filter(tab => !Model.isSolved(puzzles[tab])));
  }, [puzzles, tabs, setTabs]);
  const removeAllTabs = useCallback(() => setTabs([]), [setTabs]);

  const resetPanes = useCallback(() => {
    vsplitter.delete();
    lsplitter.delete();
    rhsplitter.delete();
    setResetSplits(true);
  }, [vsplitter, lsplitter, rhsplitter]);

  const ref = useRef(null);
  const resetMaxVisibleTabs = useCallback(() => {
    const _totalWidth = ref.current.getBoundingClientRect().width;
    const tabWidth = 180; // css .tab width
    const dropdownWidth = 40; // css .tabs-dropdown width
    const _maxVisibleTabs = Math.floor((_totalWidth - dropdownWidth) / tabWidth);
    setMaxVisibleTabs(_maxVisibleTabs);
  }, [setMaxVisibleTabs]);
  useEffect(() => {
    resetMaxVisibleTabs();
    window.addEventListener('resize', resetMaxVisibleTabs);
    return () => {
      window.removeEventListener('resize', resetMaxVisibleTabs);
    };
  }, []);

  // calculate tabs for dropdown
  const numVisibleTabs = Math.min(tabs.length, maxVisibleTabs ?? Infinity);

  return (
    <>
      <div className='header'>
        <NavHome slug={slug} activateTab={activateTab}/>
        <div className='tabs flex' ref={ref}>
          {tabs.slice(0, numVisibleTabs).map(tab => (
            <Tab
              key={tab}
              tab={tab}
              isActive={tab === slug}
              activateTab={activateTab}
              removeTab={removeTab}
              puzzleData={puzzles[tab]}
              className='across'
            />
          ))}
          {(numVisibleTabs < tabs.length || null) && (
            <div className='tabs-dropdown nav-item'>
              <MoreHorizontal/>
              <div className='tabs-dropdown-list'>
                {tabs.slice(numVisibleTabs).map(tab => (
                  <Tab
                    key={tab}
                    tab={tab}
                    isActive={tab === slug}
                    activateTab={activateTab}
                    removeTab={removeTab}
                    puzzleData={puzzles[tab]}
                    className='down'
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        <div
          className={`connection-indicator ${isConnected ? 'connected' : 'disconnected'}`}
          data-tip
          aria-label={`${isConnected ? 'Connected to server' : 'Disconnected from server'}`}
        />
        <NavSettings
          removeSolvedTabs={removeSolvedTabs}
          removeAllTabs={removeAllTabs}
          resetPanes={resetPanes}
        />
      </div>
    </>
  );
};
export default TabBar;
