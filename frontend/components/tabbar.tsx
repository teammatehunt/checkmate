import React from 'react';

import { X } from 'react-feather';

import * as Model from 'utils/model';
import * as Context from 'components/context';
import Twemoji from 'components/twemoji';
import Icon from 'assets/icon.svg';

import 'style/tabbar.css';

const Logo = ({slug, activateTab}) => {
  const activateThisTab = (e) => {
    if (e.altKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    activateTab(undefined);
  }
  const isActive = slug === undefined;
  return (
    <a
      href='/'
      className='nostyle'
    >
      <div
        className={`logo ${isActive ? 'active' : ''}`}
        onClick={activateThisTab}
      >
        <Icon className='icon'/>
        <span className='logo-text'>Checkmate</span>
      </div>
    </a>
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
  const activateThisTab = (e) => {
    if (e.altKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    activateTab(tab);
  }
  const removeThisTab = (e) => {
    e.preventDefault();
    e.stopPropagation();
    removeTab(tab);
  }
  return (
    <a
      key={tab}
      href={`/puzzles/${tab}`}
      className='nostyle'
    >
      <div
        className={`tab ${isActive ? 'active' : ''}`}
        onClick={activateThisTab}
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
    </a>
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
