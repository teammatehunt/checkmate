import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import produce from 'immer';
import { CornerRightUp, Plus, X } from 'react-feather';

import fetchJson from 'utils/fetch';
import * as Model from 'utils/model';
import colors, { statuses } from 'utils/colors';

import 'style/layout.css';
import 'style/puzzleinfo.css';

const Feeds = ({title, slugs, data, prefix, loadSlug} : {title, slugs, data, prefix?, loadSlug?}) => (
  <div className={`feeds-${title}`}>
    <span className={`title-${title}`}>{title}:</span>{' '}
    {slugs?.map((slug, i) => (
      <React.Fragment key={slug}>
        {i ? <span>, </span> : null}
        <span>
          <a {...(prefix === undefined ? {} : {
            href: `${prefix}${slug}`,
            onClick: function(e) {
              if (e.altKey || e.ctrlKey || e.shiftKey) return;
              if (loadSlug) {
                e.preventDefault();
                loadSlug(slug);
              }
            },
          })}>
            {data[slug]?.name}
          </a>
        </span>
      </React.Fragment>
    ))}
  </div>
);

enum EditState {
  DEFAULT,
  EDITING,
  WAITING,
}

interface TextFieldProps {
  name: string;
  value: string;
  textarea?: boolean;
  options?: string[];
  patchValue?: any;
  patchKey?: any;
  remove?: any;
  canReset?: boolean;
  colors?: {[value: string]: string};
}

const TextField : React.FC<TextFieldProps> = ({
  name,
  value,
  textarea=false,
  options,
  patchValue,
  patchKey,
  remove,
  canReset=true,
  colors,
}) => {
  const [prevKey, setPrevKey] = useState(name);
  const [prevValue, setPrevValue] = useState(value);
  const [editState, setEditState] = useState(EditState.DEFAULT);
  const [keyIsInput, setKeyIsInput] = useState(false);
  const keyRef = useRef(null);
  const valueRef = useRef(null);
  useEffect(() => {
    switch (editState) {
      case EditState.DEFAULT:
        keyRef.current.value = name || '';
        valueRef.current.value = value;
        if (textarea) {
          valueRef.current.style.height = '';
          valueRef.current.style.height = `${valueRef.current.scrollHeight}px`;
        }
        break;
      case EditState.WAITING:
        if (prevKey !== name || prevValue !== value) {
          setEditState(EditState.DEFAULT);
          setKeyIsInput(false);
        }
        break;
    }
    setPrevKey(name);
    setPrevValue(value);
  }, [name, prevKey, value, prevValue, editState]);
  useEffect(() => {
    if (editState === EditState.WAITING) {
      if (keyRef.current.value === name && valueRef.current.value === value) {
          setEditState(EditState.DEFAULT);
          setKeyIsInput(false);
      } else {
        let promise = null;
        if (valueRef.current.value === value) {
          promise = patchKey(keyRef.current.value);
        } else {
          promise = patchValue(valueRef.current.value);
        }
        const func = async () => {
          const response = await promise;
          if (response === null) return;
          if (!response.ok) {
            // TODO: notify error
            console.error(`PATCH request for {${keyRef.current.value}: ${valueRef.current.value}} failed`);
            setEditState(EditState.DEFAULT);
            setKeyIsInput(false);
          }
        }
        func();
      }
    }
  }, [editState]);

  const keyOnClick = (e) => {
    if (patchKey) setKeyIsInput(true);
  };
  useEffect(() => {
    if (name === null) setKeyIsInput(true);
  }, [name]);
  useEffect(() => {
    if (keyIsInput) keyRef.current.focus();
  }, [keyIsInput]);
  const resetValue = (e) => {
    e.preventDefault();
    valueRef.current.value = '';
    if (document.activeElement !== valueRef.current) {
      setEditState(EditState.WAITING);
    }
  };

  const onFocus = (e) => {
    setEditState(EditState.EDITING);
    if (!textarea) e.target.select();
  };
  const onBlur = (e) => {
    setEditState(editState => {
      if (editState === EditState.EDITING) return EditState.WAITING;
      return editState;
    });
  };
  const onKeyDown = (e) => {
    switch (e.key) {
      case 'Enter':
        if (e.target.tagName.toLowerCase() !== 'textarea') e.target.blur();
        break;
      case 'Escape':
        // firefox doesn't blur on escape automatically
        e.target.blur();
        break;
    }
  };

  const valueColor = editState === EditState.DEFAULT && colors?.[value];
  let valueColorBackground = undefined;
  let valueColorForeground = undefined;
  if (valueColor?.[0] === '^') {
    valueColorForeground = 'white';
    valueColorBackground = valueColor.substr(1);
  } else {
    valueColorBackground = valueColor;
  }
  const ValueElement = textarea ? 'textarea' : 'input';
  return (
    <div className={`tr puzzleinfo-row-${name}`}>
      <X size={16} className={`puzzleinfo-remove ${remove && editState !== EditState.WAITING ? '' : 'hidden'}`} onClick={remove}/>
      <X size={16} className='hidden puzzleinfo-remove-ghost'/>
      <div className={`td puzzleinfo-key ${patchKey ? 'key-can-be-input' : ''} ${keyIsInput ? 'key-is-input' : ''}`} onClick={keyOnClick}>
        <input
          className={`puzzleinfo-input ${keyIsInput ? '' : 'nodisplay'}`}
          type='text'
          ref={keyRef}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          disabled={editState === EditState.WAITING}
          autoComplete='off'
        />
        <span className={keyIsInput ? 'hidden' : ''}>
          {name}
        </span>
      </div>
      <div className='td puzzleinfo-value'>
        {(canReset && value && editState === EditState.DEFAULT || null) &&
          <X size={12} className='puzzleinfo-reset' color={valueColorForeground} onClick={resetValue}/>
        }
        <ValueElement
          className='puzzleinfo-input'
          type='text'
          ref={valueRef}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          disabled={editState === EditState.WAITING}
          autoComplete='off'
          {...(options ? {list: `puzzleinfo-options-${name}`} : {})}
          {...(valueColor ? {style: {color: valueColorForeground, backgroundColor: valueColorBackground}} : {})}
        />
        {(options || null) &&
        <datalist id={`puzzleinfo-options-${name}`}>
          {options.map(option => <option key={option} value={option}/>)}
        </datalist>
        }
      </div>
      <div className='td loader-container'>
        <div className={`loader ${editState === EditState.WAITING ? 'loading' : ''}`}/>
      </div>
    </div>
  );
};

interface PuzzleInfoProps {
  data: Model.Data;
  slug: string;
  loadSlug: any;
}

const PuzzleInfo : React.FC<PuzzleInfoProps> = ({
  data,
  slug,
  loadSlug,
}) => {
  const puzzle = data.puzzles[slug];
  if (!puzzle) return null;

  const [isAdding, setIsAdding] = useState(false);

  const patch = async (_data) => {
    const url = `/api/puzzles/${slug}`;
    return await fetchJson({
      url: url,
      method: 'PATCH',
      data: _data,
    });
  };

  const patchValue = (key, isTags=false) => {
    return async (value) => {
      if (key === null) {
        setIsAdding(false);
        key = '';
        if (!value) return null;
      }
      const _data = !isTags ? {[key]: value} : {tags: produce(puzzle.tags, draft => {
        draft[key] = value;
      })};
      return await patch(_data);
    };
  };

  const patchKey = (key) => {
    return async (_key) => {
      if (key === null) {
        setIsAdding(false);
        if (!_key) return null;
      }
      const _data = {tags: produce(puzzle.tags, draft => {
        if (!(key === null && _key in draft)) {
          draft[_key] = draft[key] || '';
          delete draft[key];
        }
      })};
      return await patch(_data);
    };
  };

  const remove = (key) => {
    return async () => {
      if (key === null) {
        setIsAdding(false);
        return null;
      }
      const _data = {tags: produce(puzzle.tags, draft => {
        delete draft[key];
      })};
      return await patch(_data);
    };
  };

  return (
    <>
      <h2>
        {puzzle?.name}
        {puzzle?.link &&
          <a target='_blank' href={puzzle.link}><sup><CornerRightUp size={16}/></sup></a>
        }
      </h2>
      <Feeds title='Round' slugs={puzzle?.rounds} data={data.rounds}/>
      {(puzzle?.metas?.length || !puzzle?.is_meta || null) &&
      <Feeds title='Meta' slugs={puzzle?.metas} data={data.puzzles} prefix='/puzzles/' loadSlug={loadSlug}/>
      }
      <div className='table'>
        <div className='tbody'>
          <TextField name='answer' value={puzzle?.answer} patchValue={patchValue('answer')} canReset={false}/>
          <TextField name='status' value={puzzle?.status} patchValue={patchValue('status')} options={[...statuses.keys()]} colors={colors}/>
          <TextField name='notes' textarea value={puzzle?.notes} patchValue={patchValue('notes')} colors={colors}/>
          {Object.keys(puzzle?.tags || {}).sort().map(tag => (
            <TextField key={tag} name={tag} value={puzzle.tags[tag]}
              patchKey={patchKey(tag)}
              patchValue={patchValue(tag, true)}
              remove={remove(tag)}
              colors={colors}
            />
          ))}
          {isAdding ?
            <TextField name={null} value=''
              patchKey={patchKey(null)}
              patchValue={patchValue(null, true)}
              remove={remove(null)}
              colors={colors}
            />
            :
            <div className='tr'>
              <div className='td'/>
              <div className='td'/>
              <div className='td'>
                <Plus size={20} className='puzzleinfo-add' onClick={()=>setIsAdding(true)}/>
              </div>
            </div>
          }
        </div>
      </div>
    </>
  );
};

export default PuzzleInfo;
