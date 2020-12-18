import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import produce from 'immer';
import { CornerRightUp } from 'react-feather';

import { getCookie } from 'utils/fetch';
import * as Model from 'utils/model';
import colors, { statuses } from 'utils/colors';

import 'style/layout.css';
import 'style/puzzleinfo.css';

const Feeds = ({title, slugs, data, prefix, loadSlug} : {title, slugs, data, prefix?, loadSlug?}) => (
  <div className={`feeds-${title}`}>
    <span className={`title-${title}`}>{title}:</span>{' '}
    {slugs?.map((slug, i) => (
      <>
        {i ? <span key={`delimiter-${i}`}>, </span> : null}
        <span key={slug}>
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
      </>
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
  patchValue: any;
  patchKey?: any;
  remove?: any;
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
  colors,
}) => {
  const [prevValue, setPrevValue] = useState(value);
  const [editState, setEditState] = useState(EditState.DEFAULT);
  const valueRef = useRef(null);
  useEffect(() => {
    switch (editState) {
      case EditState.DEFAULT:
        valueRef.current.value = value;
        if (textarea) {
          valueRef.current.style.height = '';
          valueRef.current.style.height = `${valueRef.current.scrollHeight}px`;
        }
        break;
      case EditState.WAITING:
        if (prevValue !== value) setEditState(EditState.DEFAULT);
        break;
    }
    setPrevValue(value);
  }, [value, prevValue, editState]);
  useEffect(() => {
    if (editState === EditState.WAITING) {
      if (valueRef.current.value === value) setEditState(EditState.DEFAULT);
      else {
        const func = async () => {
          const response = await patchValue(valueRef.current.value);
          if (!response.ok) {
            // TODO: notify error
            console.error(`PATCH request for {${name}: ${valueRef.current.value}} failed`);
            setEditState(EditState.DEFAULT);
          }
        }
        func();
      }
    }
  }, [editState]);
  const onFocus = (e) => {
    setEditState(EditState.EDITING);
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
        if (!textarea) e.target.blur();
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
  const Element = textarea ? 'textarea' : 'input';
  return (
    <div key={name} className={`tr puzzleinfo-row-${name}`}>
      <div className='td puzzleinfo-key'>{name}</div>
      <div className='td puzzleinfo-value'>
        <Element
          className='puzzleinfo-input-value'
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

  const patchValue = (key, isTags=false) => {
    const url = `/api/puzzles/${slug}`;
    return async (value) => {
      const _data = !isTags ? {[key]: value} : {tags: produce(puzzle.tags, draft => {
        draft[key] = value;
      })};
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'X-CSRFToken': getCookie('csrftoken'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(_data),
      });
      return response;
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
          <TextField name='answer' value={puzzle?.answer} patchValue={patchValue('answer')} colors={colors}/>
          <TextField name='status' value={puzzle?.status} patchValue={patchValue('status')} options={[...statuses.keys()]} colors={colors}/>
          <TextField name='notes' textarea value={puzzle?.notes} patchValue={patchValue('notes')} colors={colors}/>
          {Object.keys(puzzle?.tags || {}).sort().map(tag => (
            <TextField name={tag} value={puzzle.tags[tag]} patchValue={patchValue(tag, true)} colors={colors}/>
          ))}
        </div>
      </div>
    </>
  );
};

export default PuzzleInfo;
