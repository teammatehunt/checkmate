// filename without dash because of module naming
import mountElement from 'utils/mount';
import React, {
  useEffect,
  useState,
} from 'react';

import Base from 'components/base';
import {
  ChevronsRight,
  Clipboard,
  ExternalLink,
  Eye,
  EyeOff,
  Layout,
  Menu,
  MoreHorizontal,
  RefreshCw,
  X,
} from 'react-feather';

import ImgMaster from 'assets/getting-started/master-highlighted.png';
import ImgPuzzle from 'assets/getting-started/puzzle-highlighted.png';
import ImgMeta from 'assets/getting-started/meta.png';

import 'style/layout.css';
import 'style/documentation.css';

export const GettingStarted = () => {
  return (
    <Base>
      <title>Getting Started</title>
      <div className='root'>
        <h1>Getting Started with Checkmate</h1>
        <p>
          Checkmate is <a href='/' target='_blank'>the site you are currently looking at</a>, which we have constructed to organize puzzles during Mystery Hunt. This page highlights some tips on how to use the site.
        </p>

        <h2>Install the browser extension</h2>
        <p>
          Follow the instructions <a href='/extension' target='_blank'>here</a>. This is necessary for various integrations with the site, including being able to use Discord at all.
        </p>
        <p>
          It is recommended to also have the Discord desktop application open and be connected to voice there. If you do, you may want to disable Discord message notification sounds in your browser so you don't get double notifications. (Go to <a href='https://discord.com' target='_blank'>discord.com</a>, find your settings and untick Notifications<ChevronsRight/>Sounds<ChevronsRight/>Message.) Remember to reset this after the hunt if you might use Discord in web later.
        </p>

        <h2>Main page</h2>
        <img className='center' src={ImgMaster}/>
        <p>
          The main page lists all rounds and puzzles. Answers, statuses, notes, and tags can be edited for each puzzle by clicking on them.
        </p>
        <ul>
          <li>
            <span className='red'>Home</span>: Go to the main page.
          </li>
          <li>
            <span className='magenta'>Tabs</span>: Tabs for each puzzle appear here. Tabs for solved puzzles are green. The current tab is purple if unsolved and a brighter green if solved. Excess tabs will overflow into a dropdown menu (<MoreHorizontal/>). Tabs can be closed individually by clicking the <X/>. You can close all tabs at once or just the tabs for solved puzzles in the <Menu/> menu at the far right of the navbar.
          </li>
          <li>
            <span className='blue'>Connectivity</span>: Icon is green if connected to the server and red if disconnected. When connected, information on the page will update automatically.
          </li>
          <li>
            <span className='cyan'>Settings</span>: These settings are per browser tab.
            <ul>
              <li><span>Hide solved</span>: Hide solved puzzles from the table.</li>
              <li><span>Newest rounds at top</span>: Reverse the order of rounds displayed. This will also show a group of all metas at the top.</li>
              <li><span>Edit tags</span>: Enable adding and removing round tags. A value for the tag can be set for each puzzle in the round.</li>
              <li><span>Hide own activity</span>: If toggled, the activity of which puzzle you currently have open will not be broadcast to the rest of the team. Not recommended.</li>
              <li><span>Max puzzles to cache</span>: Checkmate will cache your most recent puzzle tabs so that the embedded web pages do not have to reload. If your machine can handle it and you like quickly switching between puzzles, set this higher. If Checkmate is using a high proportion of your system's RAM, set this lower.</li>
            </ul>
          </li>
        </ul>

        <h2>Puzzle page</h2>
        <img className='center' src={ImgPuzzle}/>
        <p>
          The puzzle page looks like this and consists of 4 panes.
        </p>
        <ul>
          <li>
            <span className='darkred'>Splits</span>: The splits separating panes are draggable and can slide to redistribute the size of each pane.
          </li>
          <li>
            <span>Sidebar</span>:
            <ul>
              <li>
                <span className='red'>Open externally (<ExternalLink/>)</span>: Click to open the pane in a new tab (or window if holding Shift).
              </li>
              <li>
                <span className='magenta'>Reload (<RefreshCw/>)</span>: Reset the pane to the original page for the puzzle.
              </li>
              <li>
                <span className='blue'>Hide / Show (<Eye/> / <EyeOff/>)</span>: Hide or show the pane. The other panes will expand to fill the page.
              </li>
              <li>
                <span className='cyan'>Go to page (<Layout/>)</span>: Open the Checkmate page for the puzzle currently navigated to in the puzzle pane. This button is enabled only when the url in the puzzle pane matches the url for a different known puzzle.
              </li>
            </ul>
          </li>
          <li>
            <span className='green'>Puzzle voice button</span>: The Checkmate extension restyles Discord to improve visibility as a sidebar for chat. In addition, a custom button is added which will open the voice channel correponding to the current puzzle. Clicking it will first attempt to move an existing voice connection to the voice channel. If that fails (either because the discord user you've logged into Checkmate with isn't connected or because the Checkmate bot exceeds its rate limit<sup>*</sup>), you will connect via the embedded Discord pane. If connecting via the Discord pane, you will have to allow microphone (and possibly video) access if you haven't connected to Discord voice in your web browser before.
          </li>
          <li>
            <span className='yellow'>Puzzle information</span>: This is the puzzle information pane. Attributes are editable. The discord avatars of people currently on the page are displayed (and usernames on hover). Please don't click the "Is meta" checkbox by mistake; it can take a lot more clicks to undo.
          </li>
        </ul>
        <div className='smaller'>
          *Discord's rate limit appears to be 10 moves per 10 seconds across the team.
        </div>

        <h2>Another puzzle page view</h2>
        <img className='center' src={ImgMeta}/>
        <p>
          This is another view of a page for a puzzle. The puzzle pane has been hidden, so the sheets pane can expand to the top. Note that any combination of the 4 panes can be hidden in this way by clicking the <Eye/> buttons.
        </p>
        <p>
          Because this puzzle has been designated as a meta puzzle, the list of feeders and their answers are also displayed in the information pane. The <Clipboard/> icon will copy the puzzle names and answers, which can be pasted into sheets.
        </p>
        <p>
          By default, Checkmate is set up to automatically add all puzzles in the same round as feeders to a meta. If the structure of the hunt is not 1 meta per round, let Brian know to edit the settings.
        </p>
      </div>
    </Base>
  );
};

export default mountElement(GettingStarted);
