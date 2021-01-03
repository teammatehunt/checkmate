import React, {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import uniqueId from 'lodash/uniqueId';

import {
  GhostX,
  FunctionalInput,
  Input,
  Td,
} from 'components/drop-ins';
import { X } from 'components/react-feather';
import Twemoji from 'components/twemoji';
import { usePrevious } from 'utils/hooks';

import 'style/layout.css';
import 'style/td-editable.css';

export enum EditState {
  DEFAULT,
  EDITING,
  RESETING,
  CHECKING,
  WAITING,
}

interface TdEditableProps {
  value: string;
  editState?: EditState;
  setEditState?: any;
  textarea?: boolean;
  expandTextarea?: boolean;
  options?: string[] | string;
  patch?: any;
  canReset?: boolean;
  colors?: {[value: string]: string};
  className?: string;
  valueClassName?: string;
  valueStyle?: any;
}

export const TdEditable : React.FC<TdEditableProps> = React.memo(({
  value,
  editState,
  setEditState,
  textarea=false,
  expandTextarea=true,
  options,
  patch,
  canReset=false,
  colors,
  className='',
  valueClassName='',
  valueStyle,
}) => {
  const [uid] = useState(uniqueId('datalist-uid-'));
  const prevValue = usePrevious(value);
  const internalEditStatePair = useState(EditState.DEFAULT);
  if (!editState) [editState, setEditState] = internalEditStatePair;
  const inputRef = useRef(null);
  useEffect(() => {
    switch (editState) {
      case EditState.DEFAULT:
        inputRef.current.value = value;
        break;
      case EditState.CHECKING:
        inputRef.current.value =  inputRef.current.value.trim();
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
  }, [value, editState]);
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

  const onClick = useMemo(() => patch ? ((e) => setEditState(EditState.EDITING)) : undefined, [patch]);
  const onFocus = useCallback((e) => setEditState(EditState.EDITING), []);

  const onBlur = useCallback((e) => {
    if (editState === EditState.EDITING) setEditState(EditState.CHECKING);
  }, [editState]);

  const color = editState === EditState.DEFAULT && colors?.[value];
  let backgroundColor = undefined;
  let foregroundColor = undefined;
  if (color?.[0] === '^') {
    foregroundColor = 'white';
    backgroundColor = color.substr(1);
  } else {
    backgroundColor = color;
  }

  const valueLines = useMemo(() => value?.split(/\r?\n/).map((line, i) => (
    <React.Fragment key={i}>
      {i ? <span className='br'/> : null}
      <Twemoji>{line}</Twemoji>
    </React.Fragment>
  )), [value]);

  return (
    <div
      className={`td td-field ${patch ? 'editable' : ''} ${EditState[editState].toLowerCase()}  ${textarea ? `textarea ${expandTextarea || editState === EditState.EDITING ? 'multiline' : ''}` : ''} ${className}`}
      onClick={onClick}
      {...(color ? {style: {color: foregroundColor, backgroundColor: backgroundColor}} : {})}
    >
      {(canReset && value && editState === EditState.DEFAULT || null) &&
      <X className='reset' color={foregroundColor} onClick={resetValue}/>
      }
      {FunctionalInput({
        className: `input ${displayStatic ? 'nodisplay' : ''}`,
        textarea: textarea,
        ref: inputRef,
        onFocus: onFocus,
        onBlur: onBlur,
        disabled: editState === EditState.WAITING,
        list: Array.isArray(options) ? uid : options,
      })}
      {(Array.isArray(options) || null) &&
      <datalist id={uid}>
        {(options as string[]).map(option => <option key={option} value={option}/>)}
      </datalist>
      }
      <div
        className={`value ${valueClassName} ${displayStatic ? '' : 'hidden'}`}
        style={valueStyle}
      >
        {valueLines}
      </div>
      {(editState === EditState.WAITING || null) &&
      <div className='loader-container'>
        <div className='loader loading'/>
      </div>
      }
    </div>
  );
});
