import React from 'react';

import { LogOut, Menu, X } from 'react-feather';

import * as Context from 'components/context';
import {
  Link,
} from 'components/drop-ins';
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
  colors: {[value: string]: string};
}

const Tab = ({
  tab,
  isActive,
  activateTab,
  removeTab,
  puzzleData,
  colors,
}) => {
  const removeThisTab = (e) => removeTab(tab);
  return (
    <div className={`tab-container ${Model.isSolved(puzzleData, colors) ? 'solved' : ''}`}>
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

const NavSettings = () => (
  <div className='nav-item nav-settings'>
    <Menu className='nav-menu'/>
    <div className='nav-dropdown'>
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
  removeTab: any;
  siteCtx: Context.SiteContextType;
  puzzles: Model.Puzzles;
  uid: number;
  colors: {[value: string]: string};
}

const TabBar : React.FC<TabBarProps> = ({
  tabs,
  slug,
  activateTab,
  removeTab,
  siteCtx,
  puzzles,
  uid,
  colors,
}) => {
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
              colors={colors}
            />
          ))}
        </div>
        <div className='flex'/>
        <NavSettings/>
      </div>
    </>
  );
};
export default TabBar;
