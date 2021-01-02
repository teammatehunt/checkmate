import React, {
  useCallback,
} from 'react';

import * as Context from 'components/context';
import {
  Link,
} from 'components/drop-ins';
import { LogOut, Menu, X } from 'components/react-feather';
import Twemoji from 'components/twemoji';
import * as Model from 'utils/model';

import Icon from 'assets/icon.svg';

import 'style/tabbar.css';

const NavHome = ({slug, activateTab}) => {
  const isActive = slug === undefined;
  return (
    <Link
      href='/'
      className='nav-item-link nostyle'
      load={() => activateTab(undefined)}
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
}

const Tab = ({
  tab,
  isActive,
  activateTab,
  removeTab,
  puzzleData,
}) => {
  const removeThisTab = (e) => removeTab(tab);
  return (
    <div className={`tab-container ${Model.isSolved(puzzleData) ? 'solved' : ''}`}>
      <Link
        key={tab}
        href={`/puzzles/${tab}`}
        className='nostyle'
        load={() => activateTab(tab)}
      >
        <div
          className={`tab ${isActive ? 'active' : ''}`}
        >
          <div className='tab-content'>
            <Twemoji>
              {puzzleData.name}
            </Twemoji>
          </div>
        </div>
      </Link>
      <div
        className='tab-remove'
        onClick={removeThisTab}
      >
        <X/>
      </div>
    </div>
  );
}

const NavSettings = ({
  removeSolvedTabs,
  removeAllTabs,
}) => (
  <div className='nav-item nav-settings'>
    <Menu className='nav-menu'/>
    <div className='nav-dropdown'>
      <div className='nav-item-link clickable' onClick={removeSolvedTabs}>
        Close solved tabs
      </div>
      <div className='nav-item-link clickable' onClick={removeAllTabs}>
        Close all tabs
      </div>
      <Link
        href='/accounts/logout'
        className='nav-item-link nostyle'
      >
        <div className='logout'>
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
  siteCtx: Context.SiteContextType;
  puzzles: Model.Puzzles;
  uid: number;
}

const TabBar : React.FC<TabBarProps> = ({
  tabs,
  slug,
  activateTab,
  setTabs,
  siteCtx,
  puzzles,
  uid,
}) => {
  const removeTab = useCallback((_slug) => {
    if (tabs.includes(_slug)) {
      const newTabs = tabs.filter(x => x !== _slug);
      setTabs(newTabs);
    }
  }, [tabs, setTabs]);

  const removeSolvedTabs = useCallback(() => {
    setTabs(tabs.filter(tab => !Model.isSolved(puzzles[tab])));
  }, [puzzles, tabs, setTabs]);
  const removeAllTabs = useCallback(() => setTabs([]), [setTabs]);

  return (
    <>
      <div className='header'>
        <NavHome slug={slug} activateTab={activateTab}/>
        <div className='tabs'>
          {tabs.map(tab => (
            <Tab
              key={tab}
              tab={tab}
              isActive={tab === slug}
              activateTab={activateTab}
              removeTab={removeTab}
              puzzleData={puzzles[tab]}
            />
          ))}
        </div>
        <div className='flex'/>
        <NavSettings
          removeSolvedTabs={removeSolvedTabs}
          removeAllTabs={removeAllTabs}
        />
      </div>
    </>
  );
};
export default TabBar;
