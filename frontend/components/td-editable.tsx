import React, {
  forwardRef,
  useEffect,
  useRef,
  useState,
} from 'react';

import { X } from 'react-feather';
import _ from 'lodash';

import {
  GhostX,
  Input,
  Td,
} from 'components/drop-ins';
import Twemoji from 'components/twemoji';

import 'style/layout.css';
import 'style/td-editable.css';

export enum EditState {
  DEFAULT = 'default',
  EDITING = 'editing',
  RESETING = 'reseting',
  CHECKING = 'checking',
  WAITING = 'waiting',
}

interface TdEditableProps {
  value: string;
  editState?: EditState;
  setEditState?: any;
  textarea?: boolean;
  options?: string[];
  patch?: any;
  canReset?: boolean;
  colors?: {[value: string]: string};
  className?: string;
  valueClassName?: string;
}

export const TdEditable : React.FC<TdEditableProps> = ({
  value,
  editState,
  setEditState,
  textarea=false,
  options,
  patch,
  canReset=false,
  colors,
  className='',
  valueClassName='',
}) => {
  const [uid] = useState(_.uniqueId('datalist-uid-'));
  const [prevValue, setPrevValue] = useState(value);
  const internalEditStatePair = useState(EditState.DEFAULT);
  if (!editState) [editState, setEditState] = internalEditStatePair;
  const inputRef = useRef(null);
  const valueRef = useRef(null);
  useEffect(() => {
    switch (editState) {
      case EditState.DEFAULT:
        inputRef.current.value = value;
        break;
      case EditState.CHECKING:
        if (inputRef.current.value === value) {
          setEditState(EditState.DEFAULT);
        } else {
          setEditState(EditState.WAITING);
        }
        break;
      case EditState.WAITING:
        if (prevValue !== value) {
          setEditState(EditState.DEFAULT);
        }
        break;
    }
    setPrevValue(value);
  }, [value, prevValue, editState]);
  useEffect(() => {
    switch (editState) {
      case EditState.DEFAULT:
        break;
      case EditState.EDITING:
        inputRef.current.focus();
        if (!textarea) inputRef.current.select();
        break;
      case EditState.RESETING:
        inputRef.current.value = '';
        setEditState(EditState.CHECKING);
        break;
      case EditState.WAITING:
        if (inputRef.current.value === value) {
            setEditState(EditState.DEFAULT);
        } else {
          const func = async () => {
            const response = await patch(inputRef.current.value);
            if (response === null) return;
            if (!response.ok) {
              setEditState(EditState.DEFAULT);
            }
          }
          func();
        }
        break;
    }
  }, [editState]);

  const resetValue = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setEditState(EditState.RESETING);
  };

  const displayStatic = !patch || (editState === EditState.DEFAULT && value);

  const onClick = patch ? ((e) => setEditState(EditState.EDITING)) : undefined;
  const onFocus = (e) => setEditState(EditState.EDITING);

  const onBlur = (e) => {
    setEditState(editState => {
      if (editState === EditState.EDITING) return EditState.CHECKING;
      return editState;
    });
  };

  const color = editState === EditState.DEFAULT && colors?.[value];
  let backgroundColor = undefined;
  let foregroundColor = undefined;
  if (color?.[0] === '^') {
    foregroundColor = 'white';
    backgroundColor = color.substr(1);
  } else {
    backgroundColor = color;
  }
  const ValueElement = textarea ? 'textarea' : 'input';
  return (
    <Td
      className={`td-field ${patch ? 'editable' : ''} ${editState} ${className}`}
      onClick={onClick}
    >
      {(canReset && value && editState === EditState.DEFAULT || null) &&
      <X className='reset' color={foregroundColor} onClick={resetValue}/>
      }
      <Input
        className={`input ${displayStatic ? 'nodisplay' : ''}`}
        textarea={textarea}
        ref={inputRef}
        onFocus={onFocus}
        onBlur={onBlur}
        disabled={editState === EditState.WAITING}
        {...(options ? {list: uid} : {})}
      />
      {(options || null) &&
      <datalist id={uid}>
        {options.map(option => <option key={option} value={option}/>)}
      </datalist>
      }
      <div
        className={`value ${valueClassName} ${textarea ? 'textarea' : ''} ${displayStatic ? '' : 'hidden'}`}
        ref={valueRef}
        {...(color ? {style: {color: foregroundColor, backgroundColor: backgroundColor}} : {})}
      >
        <Twemoji>
          {value}
        </Twemoji>
      </div>
      {(editState === EditState.WAITING || null) &&
      <div className='loader-container'>
        <div className='loader loading'/>
      </div>
      }
    </Td>
  );
};
