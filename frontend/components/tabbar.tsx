import React from 'react';

import { LogOut, Menu, X } from 'react-feather';

import * as Model from 'utils/model';
import * as Context from 'components/context';
import Twemoji from 'components/twemoji';
import Icon from 'assets/icon.svg';

import {
  Link,
} from 'components/drop-ins';

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
    <div className='tab-container'>
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

interface HeaderProps {
  tabs: string[];
  slug: string;
  activateTab: any;
  removeTab: any;
  siteCtx: Context.SiteContextType;
  puzzles: Model.Puzzles;
  uid: number;
}

const Header : React.FC<HeaderProps> = ({
  tabs,
  slug,
  activateTab,
  removeTab,
  siteCtx,
  puzzles,
  uid,
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
            />
          ))}
        </div>
        <div className='flex'/>
        <NavSettings/>
      </div>
    </>
  );
};

export default Header;
