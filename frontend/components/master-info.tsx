import React, {
  useReducer,
  useState,
} from 'react';

import { produce } from 'immer';
import Collapsible from 'react-collapsible';

import { LocalStorageObject } from 'utils/hooks';
import {
  Table,
  Tbody,
  Tr,
  Td,
} from 'components/drop-ins';
import { ChevronRight, ChevronDown, Plus } from 'components/react-feather';
import * as Model from 'utils/model';
import { fetchJson } from 'utils/fetch';

import 'style/master-info.css';

interface MasterInfoProps {
  data: Model.Data;
  hideSolved: LocalStorageObject<boolean>;
  hideLocked: LocalStorageObject<boolean>;
  hideFinishedRounds: LocalStorageObject<boolean>;
  editable: LocalStorageObject<boolean>;
  sortNewRoundsFirst: LocalStorageObject<boolean>;
  puzzleCacheSize: LocalStorageObject<number>;
  hideActivity: LocalStorageObject<boolean>;
  disableDiscord: LocalStorageObject<boolean>;
  siteDiscordEnabled: boolean;
}

const MasterInfo : React.FC<MasterInfoProps> = ({
  data,
  hideSolved,
  hideLocked,
  hideFinishedRounds,
  editable,
  sortNewRoundsFirst,
  puzzleCacheSize,
  hideActivity,
  disableDiscord,
  siteDiscordEnabled,
}) => {
  const defaultFormPuzzleData = {
    name: '',
    link: '',
    rounds: [],
    is_meta: false,
    sheet: true,
    text: siteDiscordEnabled,
    voice: siteDiscordEnabled && data.hunt.create_voice_channels_by_default,
    force: true,
  };
  const defaultFormRoundData = {
    name: '',
    link: '',
    create_placeholder: true,
  };

  const formDataReducer = produce((draft, {set, reduce}) => {
    if (set !== undefined) return set;
    const e = reduce;
    let value = undefined;
    switch (e.target.tagName.toLowerCase()) {
      case 'input':
        switch (e.target.getAttribute('type')) {
          case 'checkbox':
            value = e.target.checked;
            break;
          default:
            value = e.target.value;
            break;
        }
        break;
      case 'select':
        if (e.target.hasAttribute('multiple')) value = [...e.target.selectedOptions].map(option => option.value);
        else value = e.target.value;
        break;
    }
    draft[e.target.getAttribute('name')] = value;
  });

  const [formPuzzleData, dispatchFormPuzzleData] = useReducer(formDataReducer, defaultFormPuzzleData);
  const [formRoundData, dispatchFormRoundData] = useReducer(formDataReducer, defaultFormRoundData);

  const onFormPuzzleChange = (e) => dispatchFormPuzzleData({reduce: e});
  const onFormRoundChange = (e) => dispatchFormRoundData({reduce: e});

  const submit = (e, data) => {
    e.preventDefault();
    fetchJson({
      url: e.target.action,
      method: 'POST',
      data: data,
    });
  };

  const onFormPuzzleSubmit = (e) => {
    submit(e, formPuzzleData);
    dispatchFormPuzzleData({set: defaultFormPuzzleData});
  };
  const onFormRoundSubmit = (e) => {
    submit(e, formRoundData);
    dispatchFormRoundData({set: defaultFormRoundData});
  };

  const transitionTime = 100;

  const displayHideLocked = Object.values(data.puzzles).some((puzzle: Model.Puzzle) => puzzle?.hidden === false && Model.isLocked(puzzle));

  return (
    <>
      <h2>Add Item</h2>
      <Collapsible
        trigger={
          <>
            <ChevronRight className='closed-icon'/>
            <ChevronDown className='open-icon'/>
            <span>Add Puzzle</span>
          </>
        }
        transitionTime={transitionTime}
      >
        <form
          action='/api/puzzles/create_and_populate'
          method='post'
          onSubmit={onFormPuzzleSubmit}
        >
          <Table>
            <Tbody>
              <Tr>
                <Td>
                  <span className='colon'>Name</span>
                </Td>
                <Td>
                  <input type='text' name='name' onChange={onFormPuzzleChange} value={formPuzzleData.name} autoComplete='off'/>
                </Td>
              </Tr>
              <Tr>
                <Td>
                  <span className='colon'>Link</span>
                </Td>
                <Td>
                  <input type='text' name='link' onChange={onFormPuzzleChange} value={formPuzzleData.link} autoComplete='off'/>
                </Td>
              </Tr>
              <Tr>
                <Td>
                  <span className='colon'>Rounds</span>
                </Td>
                <Td>
                  <select name='rounds' multiple onChange={onFormPuzzleChange} value={formPuzzleData.rounds}>
                    {Object.values(data.rounds).filter(round => round.hidden === false).map(round => (
                      <option key={round.slug} value={round.slug}>{round.name}</option>
                    ))}
                  </select>
                </Td>
              </Tr>
              <Tr>
                <Td></Td>
                <Td>
                  <input type='checkbox' name='is_meta' onChange={onFormPuzzleChange} checked={formPuzzleData.is_meta}/>
                  <span>Is meta</span>
                </Td>
              </Tr>
              <Tr>
                <Td></Td>
                <Td>
                  <input type='checkbox' name='sheet' onChange={onFormPuzzleChange} checked={formPuzzleData.sheet}/>
                  <span>Create sheet</span>
                </Td>
              </Tr>
              <Tr>
                <Td></Td>
                <Td>
                  <input type='checkbox' name='text' onChange={onFormPuzzleChange} checked={formPuzzleData.text} disabled={!siteDiscordEnabled}/>
                  <span>Create text channel</span>
                </Td>
              </Tr>
              <Tr>
                <Td></Td>
                <Td>
                  <input type='checkbox' name='voice' onChange={onFormPuzzleChange} checked={formPuzzleData.voice} disabled={!siteDiscordEnabled}/>
                  <span>Create voice channel</span>
                </Td>
              </Tr>
            </Tbody>
          </Table>
          <input type='submit' value='Add Puzzle'/>
        </form>
      </Collapsible>
      <Collapsible
        trigger={
          <>
            <ChevronRight className='closed-icon'/>
            <ChevronDown className='open-icon'/>
            <span>Add Round</span>
          </>
        }
        transitionTime={transitionTime}
      >
        <form
          action='/api/rounds/create_and_populate'
          method='post'
          onSubmit={onFormRoundSubmit}
        >
          <Table>
            <Tbody>
              <Tr>
                <Td>
                  <span className='colon'>Name</span>
                </Td>
                <Td>
                  <input type='text' name='name' onChange={onFormRoundChange} value={formRoundData.name} autoComplete='off'/>
                </Td>
              </Tr>
              <Tr>
                <Td>
                  <span className='colon'>Link</span>
                </Td>
                <Td>
                  <input type='text' name='link' onChange={onFormRoundChange} value={formRoundData.link} autoComplete='off'/>
                </Td>
              </Tr>
              <Tr>
                <Td></Td>
                <Td>
                  <input type='checkbox' name='create_placeholder' onChange={onFormRoundChange} checked={formRoundData.create_placeholder}/>
                  <span>Create placeholder puzzle</span>
                </Td>
              </Tr>
            </Tbody>
          </Table>
          <input type='submit' value='Add Round'/>
        </form>
      </Collapsible>

      <h2>Settings</h2>
      <div className='master-settings'>
        <div>
          <label>
            <input type='checkbox' onChange={(e) => hideSolved.set(e.target.checked)} checked={hideSolved.value}/>
            <span>Hide solved puzzles</span>
          </label>
        </div>
        {displayHideLocked &&
        <div>
          <label>
            <input type='checkbox' onChange={(e) => hideLocked.set(e.target.checked)} checked={hideLocked.value}/>
            <span>Hide locked puzzles</span>
          </label>
        </div>
        }
        <div>
          <label>
            <input type='checkbox' onChange={(e) => hideFinishedRounds.set(e.target.checked)} checked={hideFinishedRounds.value}/>
            <span
              aria-label='All non-metas feed a meta and all metas solved.'
              data-tip
              data-tip-delay
              data-tip-size='smaller'
              data-place='below to right'
            >
              Hide finished rounds
            </span>
          </label>
        </div>
        <div>
          <label>
            <input type='checkbox' onChange={(e) => sortNewRoundsFirst.set(e.target.checked)} checked={sortNewRoundsFirst.value}/>
            <span>Newest rounds at top</span>
          </label>
        </div>
        <div>
          <label>
            <input type='checkbox' onChange={(e) => editable.set(e.target.checked)} checked={editable.value}/>
            <span>Edit tags</span>
          </label>
        </div>
        <div>
          <label>
            <input type='checkbox' onChange={(e) => hideActivity.set(e.target.checked)} checked={hideActivity.value}/>
            <span>Hide own activity</span>
          </label>
        </div>
        <div>
          <label>
            <input type='checkbox' onChange={(e) => disableDiscord.set(e.target.checked)} checked={disableDiscord.value} disabled={!siteDiscordEnabled}/>
            <span>Disable Discord</span>
          </label>
        </div>
        <div>
          <label>
            <span className='colon'>Max puzzles to cache</span>
            <input className='puzzle-cache-input' type='number' min={1} onChange={(e) => puzzleCacheSize.set(Number(e.target.value))} value={puzzleCacheSize.value}/>
          </label>
        </div>
      </div>

      {(data.login || null) &&
      <>
        <h2>Hunt Login</h2>
        <div>
          <span className='colon'>Username</span>
          <span>{data.login.username}</span>
        </div>
        <div>
          <span className='colon'>Password</span>
          <span>{data.login.password}</span>
        </div>
      </>
      }
    </>
  );
};
export default MasterInfo;
