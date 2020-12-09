import React from 'react';

import * as Model from 'components/model';
import * as Context from 'components/context';
import Icon from 'assets/icon.svg';

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
      <style jsx>{`
        .logo {
          display: flex;
          width: min-content;
          align-items: center;
          font-size: 20px;
          padding: 8px 8px 8px 0;
          cursor: pointer;
        }
        .icon {
          height: 32px;
          width: 32px;
        }
        .logo-text {
        }
      `}</style>
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
        x
      </div>
      <style jsx>{`
        .tab {
          position: relative;
          display: flex;
          height: 32px;
          width: 180px;
        }
        .tab-content {
          height: 100%;
          width: 100%;
          display: flex;
          align-items: center;
          padding: 0 4px;
          overflow: hidden;
          border: 1px solid black;
          border-bottom: none;
          border-radius: 8px 8px 0 0;
          background-color: silver;
          white-space: nowrap;
          text-overflow: ellipsis;
          cursor: pointer;
        }
        .tab.active > .tab-content {
          background-color: plum;
        }
        .tab-content:hover {
          filter: brightness(90%);
          box-shadow: 0 0 3px black;
        }
        .tab-remove {
          position: absolute;
          top: 0;
          right: 0;
          margin: 0 2px;
          padding: 0 2px;
          border-radius: 4px;
          cursor: pointer;
        }
        .tab-remove:hover {
          background-color: rgba(255,0,0,127);
          box-shadow: 0 0 3px black;
        }
      `}</style>
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
      <style jsx>{`
        .header {
          display: flex;
          align-items: flex-end;
        }
      `}</style>
    </>
  );
};

export default Header;
