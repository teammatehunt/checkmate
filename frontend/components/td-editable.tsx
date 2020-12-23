import React, {
  forwardRef,
  useEffect,
  useRef,
  useState,
} from 'react';

import { X } from 'react-feather';

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
  name: string;
  value: string;
  editState: EditState;
  setEditState: any;
  textarea?: boolean;
  options?: string[];
  patch?: any;
  canReset?: boolean;
  colors?: {[value: string]: string};
  className?: string;
  valueClassName?: string;
}

export const TdEditable : React.FC<TdEditableProps> = ({
  name,
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
  const [prevValue, setPrevValue] = useState(value);
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
              // TODO: notify error
              console.error(`PATCH request for {${name}: '${inputRef.current.value}'} failed`);
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

  const onClick = patch ? ((e) => setEditState(EditState.EDITING)) : undefined;

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
      className={`${className} td-field ${patch ? 'editable' : ''} ${editState}`}
      onClick={onClick}
    >
      {(canReset && value && editState === EditState.DEFAULT || null) &&
      <X className='reset' color={foregroundColor} onClick={resetValue}/>
      }
      <Input
        className={`input ${editState === EditState.DEFAULT && value ? 'nodisplay' : ''}`}
        textarea={textarea}
        ref={inputRef}
        onBlur={onBlur}
        disabled={editState === EditState.WAITING}
        {...(options ? {list: `datalist-tag-${name}`} : {})}
      />
      {(options || null) &&
      <datalist id={`datalist-tag-${name}`}>
        {options.map(option => <option key={option} value={option}/>)}
      </datalist>
      }
      <div
        className={`value ${valueClassName} ${textarea ? 'textarea' : ''} ${editState === EditState.DEFAULT && value ? '' : 'hidden'}`}
        ref={valueRef}
        {...(color ? {style: {color: foregroundColor, backgroundColor: backgroundColor}} : {})}
      >
        <Twemoji>
          {value}
        </Twemoji>
      </div>
    </Td>
  );
};
