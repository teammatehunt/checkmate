import React from 'react';

import { X } from 'react-feather';

import * as Model from 'utils/model';
import * as Context from 'components/context';
import Icon from 'assets/icon.svg';

import 'style/header.css';

const Logo = ({slug, activateTab}) => {
  const activateThisTab = (e) => {
    e.stopPropagation();
    activateTab(undefined);
  }
  const isActive = slug === undefined;
  return (
    <div
      className={`logo ${isActive ? 'active' : ''}`}
      onClick={activateThisTab}
    >
      <Icon className='icon'/>
      <span className='logo-text'>Checkmate</span>
    </div>
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
    e.stopPropagation();
    activateTab(tab);
  }
  const removeThisTab = (e) => {
    e.stopPropagation();
    removeTab(tab);
  }
  return (
    <div
      key={tab}
      className={`tab ${isActive ? 'active' : ''}`}
      onClick={activateThisTab}
    >
      <div className='tab-content'>
        {puzzleData.name}
      </div>
      <div
        className='tab-remove'
        onClick={removeThisTab}
      >
        <X size={16}/>
      </div>
    </div>
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
