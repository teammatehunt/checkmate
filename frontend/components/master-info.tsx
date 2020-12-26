import React, {
  useReducer,
  useState,
} from 'react';

import produce from 'immer';
import Collapsible from 'react-collapsible';
import { ChevronRight, ChevronDown, Plus } from 'react-feather';

import {
  Table,
  Tbody,
  Tr,
  Td,
} from 'components/drop-ins';
import * as Model from 'utils/model';
import { fetchJson } from 'utils/fetch';

import 'style/master-info.css';

interface MasterInfoProps {
  data: Model.Data;
}

const MasterInfo : React.FC<MasterInfoProps> = ({
  data,
}) => {
  const defaultFormPuzzleData = {
    name: '',
    link: '',
    rounds: [],
    is_meta: false,
    sheet: true,
    text: true,
    voice: true,
    force: true,
  };
  const defaultFormRoundData = {
    name: '',
    link: '',
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

  return (
    <>
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
                  <input type='text' name='name' onChange={onFormPuzzleChange} value={formPuzzleData.name}/>
                </Td>
              </Tr>
              <Tr>
                <Td>
                  <span className='colon'>Link</span>
                </Td>
                <Td>
                  <input type='text' name='link' onChange={onFormPuzzleChange} value={formPuzzleData.link}/>
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
                  <input type='checkbox' name='text' onChange={onFormPuzzleChange} checked={formPuzzleData.text}/>
                  <span>Create text channel</span>
                </Td>
              </Tr>
              <Tr>
                <Td></Td>
                <Td>
                  <input type='checkbox' name='voice' onChange={onFormPuzzleChange} checked={formPuzzleData.voice}/>
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
          action='/api/rounds'
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
                  <input type='text' name='name' onChange={onFormRoundChange} value={formRoundData.name}/>
                </Td>
              </Tr>
              <Tr>
                <Td>
                  <span className='colon'>Link</span>
                </Td>
                <Td>
                  <input type='text' name='link' onChange={onFormRoundChange} value={formRoundData.link}/>
                </Td>
              </Tr>
            </Tbody>
          </Table>
          <input type='submit' value='Add Round'/>
        </form>
      </Collapsible>
    </>
  );
};
export default MasterInfo;
