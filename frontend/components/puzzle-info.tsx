import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import produce from 'immer';
import { ExternalLink, Edit3, Plus, X } from 'react-feather';

import Twemoji from 'components/twemoji';
import fetchJson from 'utils/fetch';
import * as Model from 'utils/model';
import colors, { statuses } from 'utils/colors';

import 'style/layout.css';
import 'style/puzzleinfo.css';

enum EditState {
  DEFAULT,
  EDITING,
  WAITING,
}

interface FeedProps {
  type: string;
  slugs: string[];
  data: {[slug: string]: Model.Round|Model.Puzzle};
  prefix?: string;
  loadSlug?: any;
  options: string[];
  changeFeeds: any;
}

const Feeds : React.FC<FeedProps>= ({
  type,
  slugs,
  data,
  prefix,
  loadSlug,
  options,
  changeFeeds,
}) => {
  const [editState, setEditState] = useState(EditState.DEFAULT);
  const ref = useRef(null);

  const slugSet = new Set(slugs);
  const optionsSlugs = options.filter(slug => !slugSet.has(slug));
  const onBlur = async (e) => {
    const optionsNames = optionsSlugs.map(slug => data[slug].name);
    const index = optionsNames.indexOf(ref.current.value);
    if (index !== -1) {
      const feeds = optionsSlugs[index];
      setEditState(EditState.WAITING);
      const response = await changeFeeds({
        action: 'add',
        type: type,
        feeds: feeds,
      });
      if (!response.ok) {
        // TODO: notify error
        console.error(`POST request for adding to ${type} ${feeds} failed`);
        setEditState(EditState.DEFAULT);
      }
    } else {
      setEditState(EditState.DEFAULT);
    }
  };
  useEffect(() => {
    if (editState === EditState.WAITING) {
      setEditState(EditState.DEFAULT);
    }
  }, [slugs]);

  const remove = (slug) => async (e) => {
    setEditState(EditState.WAITING);
    const response = await changeFeeds({
      action: 'remove',
      type: type,
      feeds: slug,
    });
    if (!response.ok) {
      // TODO: notify error
      console.error(`POST request for removing from ${type} ${slug} failed`);
      setEditState(EditState.DEFAULT);
    }
  };

  const onKeyDown = (e) => {
    switch (e.key) {
      case 'Enter':
        e.target.blur();
        break;
      case 'Escape':
        // firefox doesn't blur on escape automatically
        e.target.blur();
        break;
    }
  };

  return (
    <div className={`feeds-${type}`}>
      <span className={`capitalize title-${type}`}>{type}:</span>{' '}
      {editState === EditState.DEFAULT ?
        slugs?.map((slug, i) => (
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
                <Twemoji>
                  {data[slug]?.name}
                </Twemoji>
              </a>
            </span>
          </React.Fragment>
        ))
        :
        <div className='slug-list'>
          {slugs?.map(slug => (
          <div className='puzzleinfo-remove-entity-container' key={slug}>
            <X className='puzzleinfo-remove-entity' onClick={remove(slug)}/>
            <Twemoji>
              {data[slug]?.name}
            </Twemoji>
          </div>
          ))}
          <input
            className='puzzleinfo-input-entity'
            ref={ref}
            type='text'
            list={`puzzleinfo-datalist-${type}`}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
          />
          <datalist id={`puzzleinfo-datalist-${type}`}>
            {optionsSlugs.map(slug => <option key={slug} value={data[slug].name}/>)}
          </datalist>
        </div>
      }
      {(editState === EditState.DEFAULT || null) &&
        <Edit3 className='puzzleinfo-edit' onClick={()=>setEditState(EditState.EDITING)}/>
      }
      <div className={`loader ${editState === EditState.WAITING ? 'loading' : ''}`}/>
    </div>
  );
};

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
      <X className={`puzzleinfo-remove-tag ${remove && editState !== EditState.WAITING ? '' : 'hidden'}`} onClick={remove}/>
      <X className='hidden puzzleinfo-remove-tag-ghost'/>
      <div className={`td puzzleinfo-key ${patchKey ? 'key-can-be-input' : ''} ${keyIsInput ? 'key-is-input' : ''}`} onClick={keyOnClick}>
        <input
          className={`puzzleinfo-input ${keyIsInput ? '' : 'nodisplay'}`}
          ref={keyRef}
          type='text'
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          disabled={editState === EditState.WAITING}
        />
        <span className={`capitalize ${keyIsInput ? 'hidden' : ''}`}>
          <Twemoji>
            {name}
          </Twemoji>
        </span>
      </div>
      <div className='td puzzleinfo-value'>
        {(canReset && value && editState === EditState.DEFAULT || null) &&
          <X className='puzzleinfo-reset' color={valueColorForeground} onClick={resetValue}/>
        }
        <ValueElement
          className='puzzleinfo-input'
          ref={valueRef}
          type='text'
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          disabled={editState === EditState.WAITING}
          {...(options ? {list: `puzzleinfo-datalist-tag-${name}`} : {})}
          {...(valueColor ? {style: {color: valueColorForeground, backgroundColor: valueColorBackground}} : {})}
        />
        {(options || null) &&
        <datalist id={`puzzleinfo-datalist-tag-${name}`}>
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

  const removeTag = (key) => {
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

  const changeFeeds = async ({action, type, feeds}) => {
    let url = null;
    switch (type) {
      case 'round':
        url = `/api/rounds/${feeds}/puzzles`;
        break;
      case 'meta':
        url = `/api/puzzles/${feeds}/feeders`;
        break;
    }
    return await fetchJson({
      url: url,
      method: 'POST',
      data: {
        action: action,
        puzzles: [slug],
      },
    });
  };


  return (
    <>
      <h2>
        <Twemoji>
          {puzzle?.name}
        </Twemoji>
        {puzzle?.link &&
          <a target='_blank' href={puzzle.link}><ExternalLink className='puzzleinfo-external-link'/></a>
        }
      </h2>
      <Feeds type='round' slugs={puzzle?.rounds} data={data.rounds} options={Object.keys(data.rounds)} changeFeeds={changeFeeds}/>
      {(puzzle?.metas?.length || !puzzle?.is_meta || null) &&
      <Feeds type='meta' slugs={puzzle?.metas} data={data.puzzles} prefix='/puzzles/' loadSlug={loadSlug} options={Object.keys(data.puzzles).filter(slug => data.puzzles[slug].is_meta)} changeFeeds={changeFeeds}/>
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
              remove={removeTag(tag)}
              colors={colors}
            />
          ))}
          {isAdding ?
            <TextField name={null} value=''
              patchKey={patchKey(null)}
              patchValue={patchValue(null, true)}
              remove={removeTag(null)}
              colors={colors}
            />
            :
            <div className='tr'>
              <div className='td'/>
              <div className='td'/>
              <div className='td'>
                <Plus className='puzzleinfo-add' onClick={()=>setIsAdding(true)}/>
              </div>
            </div>
          }
        </div>
      </div>
    </>
  );
};

export default PuzzleInfo;
