import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import produce from 'immer';
import isEqual from 'lodash/isEqual';
import { DndProvider, DragSourceMonitor, DropTargetMonitor, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import {
  Input,
  Link,
  Table,
  Tbody,
  Tr,
  Td,
} from 'components/drop-ins';
import {
  EditState,
  TdEditable,
} from 'components/td-editable';
import { Check, Edit3, Plus, X } from 'components/react-feather';
import Twemoji from 'components/twemoji';
import {
  fetchJson,
  patch,
} from 'utils/fetch';
import * as Model from 'utils/model';

import 'style/layout.css';
import 'style/puzzle-info.css';

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
      if (!isEqual(prevSlugs, slugs)) {
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

  const visibleSlugs = slugs?.filter(slug => data[slug]?.hidden === false);

  return (
    <div className={`feeds feeds-${type}`}>
      <div className={`capitalize colon title-${type}`}>{type}{visibleSlugs.length > 1 ? 's' : ''}</div>
      {editState === EditState.DEFAULT ?
        visibleSlugs?.map((slug) => (
          <div className='comma' key={slug}>
            <Link
              className='restyle'
              href={prefix === undefined ? undefined : `${prefix}${slug}`}
              load={() => loadSlug(slug)}
            >
              <Twemoji>
                {data[slug]?.name}
              </Twemoji>
            </Link>
          </div>
        ))
        :
        <>
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
        </>
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
  const dragRef = useRef(null);
  const dropRef = useRef(null);
  const [, drop] = useDrop({
    accept: 'feeder',
    hover: (item: DragItem, monitor: DropTargetMonitor) => {
      if (!dropRef.current) return;
      if (item.index === index) return;

      const hoverBoundingRect = dropRef.current?.getBoundingClientRect()
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
      if (!dragRef.current) return;
      if (item.index === item.originalIndex) return;
      move(item.slug, item.index);
    },
  });
  const opacity = isDragging ? 0 : 1;
  drag(dragRef);
  drop(dropRef);
  return (
    <div className={`drop-container ${className}`} ref={dropRef}>
      <div className='drag-container' ref={dragRef} style={{ opacity }}>
        {children}
      </div>
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
        if (!isEqual(prevSlugs, slugs)) {
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
        setDraggingItem(null);
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
      setDraggingItem(null);
      setPressedEnter(false);
      setEditState(EditState.EDITING);
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
      setDraggingItem(null);
      setPressedEnter(false);
      setEditState(EditState.EDITING);
    }
  };

  const staticSlugs = slugs.filter(slug => slug !== draggingItem?.slug);
  const localSlugs = draggingItem ? [...staticSlugs.slice(0, draggingItem.index), draggingItem.slug, ...staticSlugs.slice(draggingItem.index)] : slugs;

  return (
    <div className='feeders'>
      <div className='feeders-header'>
        <div className={`capitalize colon title-${feederType}`}>{feederType}</div>
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
          <Table className='feeders-list'>
            <Tbody>
              {slugs?.map((slug, i) => data[slug]?.hidden ? null : (
                <Tr key={slug}>
                  <Td>
                    <Link
                      className='restyle'
                      href={`/puzzles/${slug}`}
                      load={() => loadSlug(slug)}
                    >
                      <Twemoji>
                        {data[slug]?.name}
                      </Twemoji>
                    </Link>
                  </Td>
                  <Td className='answerize feeders-answer'>
                    {data[slug]?.answer || ''}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
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
  const [editStateKey, setEditStateKey] = useState(EditState.DEFAULT);
  const [editStateValue, setEditStateValue] = useState(EditState.DEFAULT);

  const isWaiting = editStateKey === EditState.WAITING || editStateValue === EditState.WAITING;

  const _remove = remove ? async () => {
    setEditStateKey(EditState.WAITING);
    const response = await remove();
    if (!response.ok) setEditStateKey(EditState.DEFAULT);
  } : undefined;

  useEffect(() => {
    if (name === null) {
      setEditStateKey(EditState.EDITING);
    }
  }, []);

  return (
    <Tr className={`puzzleinfo-row-${name}`}>
      <X className={`puzzleinfo-remove-tag ${_remove && !isWaiting ? '' : 'hidden'}`} onClick={_remove}/>
      <X className='hidden puzzleinfo-remove-tag-ghost'/>
      <TdEditable
        className='tag-key'
        valueClassName='capitalize colon text-align-right'
        value={name}
        patch={patchKey}
        editState={editStateKey}
        setEditState={setEditStateKey}
      />
      <TdEditable
        className={`tag-value ${className}`}
        value={value}
        textarea={textarea}
        patch={patchValue}
        options={options}
        colors={colors}
        editState={editStateValue}
        setEditState={setEditStateValue}
        canReset
      />
      <Td className='loader-container'>
        <div className={`loader ${isWaiting ? 'loading' : ''}`}/>
      </Td>
    </Tr>
  );
};

interface PuzzleInfoProps {
  data: Model.Data;
  slug: string;
  loadSlug: any;
  statuses: {[status: string]: string};
  colors: {[value: string]: string};
}

const PuzzleInfo : React.FC<PuzzleInfoProps> = ({
  data,
  slug,
  loadSlug,
  statuses,
  colors,
}) => {
  const puzzle = data.puzzles[slug];
  if (!puzzle) return null;

  const [isAdding, setIsAdding] = useState(false);

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
      return await patch({slug, data: _data});
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
      return await patch({slug, data: _data});
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
      return await patch({slug, data: _data});
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
      <Table className='puzzleinfo-tags'>
        <Tbody>
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
            <Tr>
              <Td/>
              <Td/>
              <Td>
                <Plus className='plus-add larger' onClick={()=>setIsAdding(true)}/>
              </Td>
            </Tr>
          }
        </Tbody>
      </Table>
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
