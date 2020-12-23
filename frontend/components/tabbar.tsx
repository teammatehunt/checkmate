import React from 'react';

import { X } from 'react-feather';

import * as Model from 'utils/model';
import * as Context from 'components/context';
import Twemoji from 'components/twemoji';
import Icon from 'assets/icon.svg';

import {
  Link,
} from 'components/drop-ins';

import 'style/tabbar.css';

const Logo = ({slug, activateTab}) => {
  const isActive = slug === undefined;
  return (
    <Link
      href='/'
      className='nostyle'
      load={() => activateTab(undefined)}
    >
      <div
        className={`logo ${isActive ? 'active' : ''}`}
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
  const removeThisTab = (e) => {
    e.preventDefault();
    e.stopPropagation();
    removeTab(tab);
  }
  return (
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
        <div
          className='tab-remove'
          onClick={removeThisTab}
        >
          <X size={16}/>
        </div>
      </div>
    </Link>
  );
}

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
        <Logo slug={slug} activateTab={activateTab}/>
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
        <div className='flex'/>
      </div>
    </>
  );
};

export default Header;
