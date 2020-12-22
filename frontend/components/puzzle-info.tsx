import React, {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import produce from 'immer';
import _ from 'lodash';
import { DndProvider, DragSourceMonitor, DropTargetMonitor, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Check, Edit3, ExternalLink, Plus, X } from 'react-feather';

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

const Input = forwardRef<any, any>((props, ref) => {
  const {textarea, ...rest} = props;
  const Element = textarea ? 'textarea' : 'input';
  const onKeyDown = props.onKeyDown || ((e) => {
    switch (e.key) {
      case 'Enter':
        e.target.blur();
        break;
      case 'Escape':
        // firefox doesn't blur on escape automatically
        e.target.blur();
        break;
    }
  });

  return (
    <Element
      ref={ref}
      type='text'
      onKeyDown={onKeyDown}
      {...rest}
    />
  );
});

interface FeedsProps {
  type: string;
  slugs: string[];
  data: {[slug: string]: Model.Round|Model.Puzzle};
  prefix?: string;
  loadSlug?: any;
  options: string[];
  changeFeeds: any;
}

const Feeds : React.FC<FeedsProps>= ({
  type,
  slugs,
  data,
  prefix,
  loadSlug,
  options,
  changeFeeds,
}) => {
  const [editState, setEditState] = useState(EditState.DEFAULT);
  const [prevSlugs, setPrevSlugs] = useState(slugs);

  const slugSet = new Set(slugs);
  const optionsSlugs = options.filter(slug => !slugSet.has(slug));
  useEffect(() => {
    if (editState === EditState.WAITING) {
      if (!_.isEqual(prevSlugs, slugs)) {
        setEditState(EditState.DEFAULT);
      }
    }
    setPrevSlugs(slugs);
  }, [editState, prevSlugs, slugs]);

  const onBlur = async (e) => {
    const optionsNames = optionsSlugs.map(slug => data[slug].name);
    const index = optionsNames.indexOf(e.target.value);
    if (index === -1) {
      setEditState(EditState.DEFAULT);
    } else {
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
    }
  };
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

  return (
    <div className={`feeds-${type}`}>
      <span className={`capitalize colon title-${type}`}>{type}</span>
      {editState === EditState.DEFAULT ?
        slugs?.map((slug, i) => data[slug]?.hidden ? null : (
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
        <div className='feeds-edit-list'>
          {slugs?.map(slug => data[slug]?.hidden ? null : (
              <div className='puzzleinfo-remove-entity-container' key={slug}>
                <X className='puzzleinfo-remove-entity' onClick={remove(slug)}/>
                <Twemoji>
                  {data[slug]?.name}
                </Twemoji>
              </div>
          ))}
          <Input
            className='puzzleinfo-input-entity'
            list={`puzzleinfo-datalist-${type}`}
            onBlur={onBlur}
          />
          <datalist id={`puzzleinfo-datalist-${type}`}>
            {optionsSlugs.map(slug => <option key={slug} value={data[slug].name}/>)}
          </datalist>
        </div>
      }
      {(editState === EditState.DEFAULT || null) &&
        <Edit3 className='puzzleinfo-edit' onClick={()=>setEditState(EditState.EDITING)}/>
      }
      {(editState === EditState.WAITING || null) &&
        <div className='loader loading'/>
      }
    </div>
  );
};

interface DragItem {
  index: number;
  originalIndex: number;
  slug: string;
  type: string;
}

interface FeederDndProps {
  slug: string;
  index: number;
  move: any;
  setDraggingItem: any;
  className?: string;
}

const FeederDnd : React.FC<FeederDndProps> = ({
  slug,
  index,
  move,
  setDraggingItem,
  className,
  children,
}) => {
  const ref = useRef(null);
  const [, drop] = useDrop({
    accept: 'feeder',
    hover: (item: DragItem, monitor: DropTargetMonitor) => {
      if (!ref.current) return;
      if (item.index === index) return;

      const hoverBoundingRect = ref.current?.getBoundingClientRect()
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      const hoverClientY = clientOffset.y - hoverBoundingRect.top
      if (item.index < index && hoverClientY < hoverMiddleY) return;
      if (item.index > index && hoverClientY > hoverMiddleY) return;

      setDraggingItem({
        slug: item.slug,
        index: index,
      });

      // NB: mutating the monitor item here
      item.index = index;
    },
  });
  const [{ isDragging }, drag] = useDrag({
    item: { type: 'feeder', slug, index, originalIndex: index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: (item: DragItem, monitor: DragSourceMonitor) => {
      if (!ref.current) return;
      if (item.index === item.originalIndex) return;
      move(item.slug, item.index);
    },
  });
  const opacity = isDragging ? 0 : 1;
  drag(drop(ref));
  return (
    <div className={className ?? ''} ref={ref} style={{ opacity }}>
      {children}
    </div>
  );
};

interface FeedersProps {
  type: string;
  slugs: string[];
  data: {[slug: string]: Model.Puzzle};
  loadSlug: any;
  options: string[];
  changeFeeders: any;
}

const Feeders : React.FC<FeedersProps>= ({
  type,
  slugs,
  data,
  loadSlug,
  options,
  changeFeeders,
}) => {
  const [editState, setEditState] = useState(EditState.DEFAULT);
  const [prevSlugs, setPrevSlugs] = useState(slugs);
  const [toDone, setToDone] = useState(false);
  const [pressedEnter, setPressedEnter] = useState(false);
  const [draggingItem, setDraggingItem] = useState(null);
  const ref = useRef(null);

  const feederType = type === 'round' ? 'puzzles' : 'feeders';
  const slugSet = new Set(slugs);
  const optionsSlugs = options.filter(slug => !slugSet.has(slug));

  useEffect(() => {
    switch (editState) {
      case EditState.DEFAULT:
        if (toDone) setToDone(false);
        break;
      case EditState.EDITING:
        if (toDone) setEditState(EditState.DEFAULT);
        break;
      case EditState.WAITING:
        if (!_.isEqual(prevSlugs, slugs)) {
          if (toDone) {
            setEditState(EditState.DEFAULT);
          } else {
            ref.current.value = '';
            setEditState(EditState.EDITING);
            if (pressedEnter) {
              ref.current.focus();
            }
          }
          setDraggingItem(null);
          setPressedEnter(false);
        }
        break;
    }
    setPrevSlugs(slugs);
  }, [editState, pressedEnter, prevSlugs, slugs, toDone]);

  const onKeyDown = (e) => {
    switch (e.key) {
      case 'Enter':
        setPressedEnter(true);
        e.target.blur();
        break;
      case 'Escape':
        // firefox doesn't blur on escape automatically
        e.target.blur();
        break;
    }
  };
  const onBlur = async (e) => {
    const puzzleSlugs = Object.keys(data);
    const puzzleNames = puzzleSlugs.map(slug => data[slug].name);
    const index = puzzleNames.indexOf(e.target.value);
    if (index === -1) {
      if (pressedEnter) e.target.focus();
      setPressedEnter(false);
    } else {
      const feeder = puzzleSlugs[index];
      setEditState(EditState.WAITING);
      const response = await changeFeeders({
        action: 'add',
        type: type,
        feeder: feeder,
      });
      if (!response.ok) {
        // TODO: notify error
        console.error(`POST request for adding ${feeder} failed`);
        if (toDone) setEditState(EditState.DEFAULT);
        else {
          if (pressedEnter) e.target.focus();
          setEditState(EditState.EDITING);
        }
        setPressedEnter(false);
      }
    }
  };
  const remove = (slug) => async (e) => {
    setEditState(EditState.WAITING);
    const response = await changeFeeders({
      action: 'remove',
      type: type,
      feeder: slug,
    });
    if (!response.ok) {
      // TODO: notify error
      console.error(`POST request for removing ${slug} failed`);
    }
  };
  const move = async (slug, index) => {
    setEditState(EditState.WAITING);
    const response = await changeFeeders({
      action: 'move',
      type: type,
      feeder: slug,
      order: index,
    });
    if (!response.ok) {
      // TODO: notify error
      console.error(`POST request for moving ${slug} failed`);
      setEditState(EditState.EDITING);
    }
  };

  const staticSlugs = slugs.filter(slug => slug !== draggingItem?.slug);
  const localSlugs = draggingItem ? [...staticSlugs.slice(0, draggingItem.index), draggingItem.slug, ...staticSlugs.slice(draggingItem.index)] : slugs;

  return (
    <div className='feeders'>
      <div className='feeders-header'>
        <span className={`capitalize colon title-${feederType}`}>{feederType}</span>
        {(() => {
          switch (editState) {
            case EditState.DEFAULT:
              return <Edit3 className='puzzleinfo-edit' onClick={()=>setEditState(EditState.EDITING)}/>;
            case EditState.EDITING:
              return <Check className='puzzleinfo-done' onClick={()=>setToDone(true)}/>;
          }
          return null;
        })()}
        {(editState === EditState.WAITING || null) &&
          <div className='loader loading'/>
        }
      </div>
      <div className={`feeders-${feederType}`}>
        {editState === EditState.DEFAULT ?
          <div className='table feeders-list'>
            <div className='tbody'>
              {slugs?.map((slug, i) => data[slug]?.hidden ? null : (
                <div key={slug} className='tr'>
                  <div className='td'>
                    <a
                      href={`/puzzles/${slug}`}
                      onClick={(e) => {
                        if (e.altKey || e.ctrlKey || e.shiftKey) return;
                        if (loadSlug) {
                          e.preventDefault();
                          loadSlug(slug);
                        }
                      }}
                    >
                      <Twemoji>
                        {data[slug]?.name}
                      </Twemoji>
                    </a>
                  </div>
                  <div className='td answerize feeders-answer'>
                    {data[slug]?.answer || ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
          :
          <div className='feeders-edit-list'>
            <DndProvider backend={HTML5Backend}>
              {localSlugs?.map((slug, i) => (
                <FeederDnd
                  key={slug}
                  index={i}
                  slug={slug}
                  setDraggingItem={setDraggingItem}
                  move={move}
                  className={data[slug]?.hidden ? 'nodisplay' : ''}
                >
                  <div className='puzzleinfo-remove-entity-container'>
                    <X className='puzzleinfo-remove-entity' onClick={remove(slug)}/>
                    <Twemoji>
                      {data[slug]?.name}
                    </Twemoji>
                  </div>
                </FeederDnd>
              ))}
            </DndProvider>
            <Input
              ref={ref}
              className='puzzleinfo-input-entity'
              onKeyDown={onKeyDown}
              onBlur={onBlur}
              list={`puzzleinfo-datalist-${type}`}
            />
            <datalist id={`puzzleinfo-datalist-${type}`}>
              {optionsSlugs.map(slug => <option key={slug} value={data[slug].name}/>)}
            </datalist>
          </div>
        }
      </div>
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
  className?: string;
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
  className='',
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
    console.log(e)
    setEditState(editState => {
      if (editState === EditState.EDITING) return EditState.WAITING;
      return editState;
    });
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
      <div className={`td colon puzzleinfo-key ${patchKey ? 'key-can-be-input' : ''} ${keyIsInput ? 'key-is-input' : ''}`} onClick={keyOnClick}>
        <Input
          className={`puzzleinfo-input ${keyIsInput ? '' : 'nodisplay'}`}
          ref={keyRef}
          onFocus={onFocus}
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
        <Input
          textarea={textarea}
          className={`puzzleinfo-input ${className}`}
          ref={valueRef}
          onFocus={onFocus}
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

  const changeRelations = async ({type, feeds, feeder, ...kwargs}) => {
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
        puzzles: [feeder],
        ...kwargs,
      },
    });
  };

  const changeFeeds = async (kwargs) => {
    return await changeRelations({feeder: slug, ...kwargs});
  };

  const changeFeeders = async (kwargs) => {
    return await changeRelations({feeds: slug, ...kwargs});
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
      <Feeds
        type='round'
        slugs={puzzle?.rounds}
        data={data.rounds}
        options={Object.keys(data.rounds)}
        changeFeeds={changeFeeds}
      />
      {(puzzle?.metas?.length || !puzzle?.is_meta || null) &&
      <Feeds
        type='meta'
        slugs={puzzle?.metas}
        data={data.puzzles}
        prefix='/puzzles/'
        loadSlug={loadSlug}
        options={Object.keys(data.puzzles).filter(_slug => data.puzzles[_slug].is_meta && _slug !== slug)}
        changeFeeds={changeFeeds}
      />
      }
      <div className='table puzzleinfo-tags'>
        <div className='tbody'>
          <TextField className='answerize' name='answer' value={puzzle?.answer} patchValue={patchValue('answer')} canReset={false}/>
          <TextField name='status' value={puzzle?.status} patchValue={patchValue('status')} options={Object.keys(statuses)} colors={statuses}/>
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
      {(puzzle?.is_meta || null) &&
      <Feeders
        type='meta'
        slugs={puzzle?.feeders}
        data={data.puzzles}
        loadSlug={loadSlug}
        options={(() => {
          let slugSet = new Set();
          const puzzles = puzzle?.rounds.map(round => data.rounds[round].puzzles).flat().filter(_slug => {
            const add = !slugSet.has(_slug) && _slug !== slug;
            slugSet.add(_slug);
            return add;
          });
          return puzzles;
        })()}
        changeFeeders={changeFeeders}
      />
      }
    </>
  );
};

export default PuzzleInfo;
