import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import produce from 'immer';
import orderBy from 'lodash/orderBy';
import humanizeDuration from 'humanize-duration';

import {
  Link,
  Table,
  Tbody,
  Tr,
  Th,
  Td,
} from 'components/drop-ins';
import { Plus, X } from 'components/react-feather';
import {
  EditState,
  TdEditable,
} from 'components/td-editable';
import Twemoji from 'components/twemoji';
import { patch } from 'utils/fetch';
import * as Model from 'utils/model';

import 'style/master.css';

const SizingRow = ({maxRoundTags, hasExtra}) => {
  // zero height row to set widths
  return (
    <div className='tr sub-master sizer'>
      <div className='td sub-master sizer name'/>
      <div className='td sub-master sizer answer answerize'/>
      <div className='td sub-master sizer status'/>
      <div className='td sub-master sizer notes'/>
      <div className='td sub-master sizer open-for'/>
      {Array.from({length: maxRoundTags}).map((_, i) => (
        <div key={i} className='td sub-master sizer tag'/>
      ))}
      {(hasExtra || null) &&
        <div className='td sub-master sizer tag-extra'/>
      }
    </div>
  );
}

interface RoundProps {
  data: Model.Data;
  round: Model.Round;
  visible: boolean;
  editable: boolean;
  setNumTagsWithEditing: any;
  numTotalTagColumns: number;
}

const Round : React.FC<RoundProps> = React.memo(({
  data,
  round,
  visible,
  editable,
  setNumTagsWithEditing,
  numTotalTagColumns,
}) => {
  const [editState, setEditState] = useState(EditState.DEFAULT);
  const prevRoundTagsRef = useRef(null);

  useEffect(() => {
    if (!editable) setEditState(EditState.DEFAULT);
  }, [editable]);
  useEffect(() => {
    if (editState === EditState.DEFAULT) {
      setNumTagsWithEditing(0);
    } else {
      setNumTagsWithEditing(round.round_tags.length + 1);
    }
    if (editState === EditState.WAITING) {
      if (prevRoundTagsRef.current !== round.round_tags) {
        setEditState(EditState.DEFAULT);
      }
    }
    prevRoundTagsRef.current = round.round_tags;
  }, [editState, round.round_tags]);
  const patchRoundTags = useCallback(async (newRoundTags) => {
    const response = await patch({
      type: 'round',
      slug: round.slug,
      data: {
        'round_tags': newRoundTags,
      },
    });
    return response;
  }, [round]);
  const patchTag = useCallback(async (tag) => {
    const roundTags = round.round_tags ?? [];
    const trimmedTag = tag;
    if (!trimmedTag || roundTags.includes(trimmedTag)) {
      setEditState(EditState.DEFAULT);
      return null;
    } else {
      const newRoundTags = [...roundTags, trimmedTag].sort();
      return await patchRoundTags(newRoundTags);
    }
  }, [round.round_tags, patchRoundTags]);
  const remove = (i) => async (e) => {
    const roundTags = round.round_tags ?? [];
    const newRoundTags = [...roundTags.slice(0, i), ...roundTags.slice(i + 1)];
    return await patchRoundTags(newRoundTags);
  };

  let tagOptions = useMemo(() => {
    if (editState === EditState.EDITING) {
      const roundTags = new Set(round.round_tags);
      const newPuzzleTags = new Set(round.puzzles.map(slug => Object.keys(data.puzzles[slug]?.tags ?? {})).flat().filter(tag => !roundTags.has(tag)));
      return [...newPuzzleTags].sort();
    } else {
      return undefined;
    }
  }, [round, editState, data]);

  // Round is always visible (we need it because it is sticky)
  return (
    <div
      className={`tr sub-master round ${round.is_pseudoround ? 'pseudoround' : ''}`}
      id={`round-${round.slug}`}
    >
      <div className='th sub-master name'><div>
        <Twemoji>
          {round.name}
        </Twemoji>
      </div></div>
      <div className='th sub-master answer'><div>Answer</div></div>
      <div className='th sub-master status'><div>Status</div></div>
      <div className='th sub-master notes'><div>Notes</div></div>
      <div className='th sub-master open-for'><div>Open For</div></div>
      {(round.round_tags ?? []).map((tag, i) => (
        <div key={tag} className='th sub-master tag capitalize'>
          <div>
            <div className='sub-master tag-name'>{tag}</div>
            {((editable && editState === EditState.DEFAULT) || null) &&
            <X className='sub-master round-remove-tag' onClick={remove(i)}/>
            }
          </div>
        </div>
      ))}
      {Array.from({length: numTotalTagColumns - (round.round_tags?.length ?? 0)}).map((_, i) => {
        if (!i && editable) {
          if (editState === EditState.DEFAULT) {
            return (
              <div key={i} className='th round-add-tag-container'>
                <Plus className='sub-master round-add-tag' onClick={() => setEditState(EditState.EDITING)}/>
              </div>
            );
          } else {
            return (
              <TdEditable
                key={i}
                value=''
                editState={editState}
                setEditState={setEditState}
                patch={patchTag}
                options={tagOptions}
                className='sub-master round-add-tag-editing'
              />
            );
          }
        } else {
          return (
            <div key={i} className='th empty'/>
          );
        }
      })}
    </div>
  );
});

interface PuzzleProps {
  puzzle: Model.Puzzle;
  round: string;
  roundTags: string[] | null;
  loadSlug: any;
  statuses: {[status: string]: string};
  colors: {[value: string]: string};
  isPseudoround?: boolean;
  visible: boolean;
  editable: boolean;
}

const Puzzle : React.FC<PuzzleProps> = React.memo(({
  puzzle,
  round,
  roundTags,
  loadSlug,
  statuses,
  colors,
  isPseudoround,
  visible,
  editable,
}) => {
  const patchValue = useMemo(() => (key, isTags=false) => {
    return async (value) => {
      const _data = !isTags ? {[key]: value} : {tags: produce(puzzle.tags, draft => {
        draft[key] = value;
      })};
      return await patch({slug: puzzle.slug, data: _data});
    };
  }, [puzzle]);
  const patchAnswer = useMemo(() => patchValue('answer'), [puzzle]);
  const patchStatus = useMemo(() => patchValue('status'), [puzzle]);
  const patchNotes = useMemo(() => patchValue('notes'), [puzzle]);
  const patchTag = (key) => {
    return async (value) => {
      const _data = {tags: produce(puzzle.tags, draft => {
        draft[key] = value;
      })};
      return await patch({slug: puzzle.slug, data: _data});
    };
  };

  const now = Date.now();
  const hasCreated = puzzle.created ?? undefined !== undefined;
  const hasSolved = puzzle.solved ?? undefined !== undefined;
  const createdTimestamp = hasCreated ? Date.parse(puzzle.created) : now;
  const solvedTimestamp = hasSolved ? Date.parse(puzzle.solved) : now;
  const duration = solvedTimestamp - createdTimestamp;
  const humanDuration = duration < 60 * 1000 ? 'just now' : shortEnglishHumanizer(
    duration,
    {
      largest: 2,
      units: ['y', 'mo', 'd', 'h', 'm'],
      round: true,
    },
  );
  const openForStyle = useMemo(() => Model.isSolved(puzzle) ? {backgroundColor: colors?.solved} : undefined, [puzzle, colors]);

  const answerWidth = 25; // should max with css
  const answerStyle = puzzle.answer.length < answerWidth ? undefined : {transform: `scale(${answerWidth / puzzle.answer.length})`};

  if (!visible) {
    // shortened complexity when offscreen
    return (
      <div
        className={`tr sub-master puzzle ${puzzle.is_meta ? 'meta' : ''} ${isPseudoround ? 'pseudoround' : ''}`}
        id={`round-${round}--puzzle-${puzzle.slug}`}
      >
        <div className='td sub-master name'><div>
          {Link({
            className: 'restyle',
            href: `/puzzles/${puzzle.slug}`,
            load: () => loadSlug(puzzle.slug),
            children: (
              <span>
                {puzzle.is_meta ? <span className='metatag'/> : null}{puzzle.name}
              </span>
            ),
          })}
        </div></div>
      </div>
    );
  }

  return (
    <div className={`tr sub-master puzzle ${puzzle.is_meta ? 'meta' : ''} ${isPseudoround ? 'pseudoround' : ''}`}>
      <div className='td sub-master name'><div>
        {Link({
          className: 'restyle',
          href: `/puzzles/${puzzle.slug}`,
          load: () => loadSlug(puzzle.slug),
          children: (
            <Twemoji>
              {puzzle.is_meta ? <span className='metatag'/> : null}{puzzle.name}
            </Twemoji>
          ),
        })}
      </div></div>
      <TdEditable
        className='sub-master answerize answer'
        value={puzzle.answer}
        patch={patchAnswer}
        valueStyle={answerStyle}
      />
      <TdEditable
        className='sub-master'
        value={puzzle.status}
        patch={patchStatus}
        options='master-status-options'
        colors={statuses}
      />
      <TdEditable
        className='sub-master notes'
        value={puzzle.notes}
        patch={patchNotes}
        textarea
        expandTextarea={false}
      />
      <div className='td sub-master open-for' style={openForStyle}><div>
        {hasCreated ? humanDuration : null}
      </div></div>
      {(roundTags ?? []).map(tag => (
        <TdEditable
          key={tag}
          className='sub-master tag'
          value={puzzle.tags[tag] ?? ''}
          patch={patchTag(tag)}
          colors={colors}
        />
      ))}
    </div>
  );
});

const shortEnglishHumanizer = humanizeDuration.humanizer({
  language: 'shortEn',
  languages: {
    shortEn: {
      y: (c) => 'yr' + (c === 1 ? '' : 's'),
      mo: (c) => 'mo' + (c === 1 ? '' : 's'),
      w: (c) => 'wk' + (c === 1 ? '' : 's'),
      d: (c) => 'day' + (c === 1 ? '' : 's'),
      h: (c) => 'hr' + (c === 1 ? '' : 's'),
      m: (c) => 'min' + (c === 1 ? '' : 's'),
      s: (c) => 'sec' + (c === 1 ? '' : 's'),
      ms: (c) => 'msec' + (c === 1 ? '' : 's'),
    },
  },
});


interface MasterProps {
  isActive: boolean;
  data: Model.Data;
  loadSlug: any;
  statuses: {[status: string]: string};
  colors: {[value: string]: string};
  hideSolved: boolean;
  editable: boolean;
  sortNewRoundsFirst: boolean;
  yDims: {[key: string]: number};
}

const Master : React.FC<MasterProps> = ({
  isActive,
  data,
  loadSlug,
  statuses,
  colors,
  hideSolved,
  editable,
  sortNewRoundsFirst,
  yDims,
}) => {
  const masterRef = useRef(null);
  const [numTagsWithEditing, setNumTagsWithEditing] = useState(0);

  if (!isActive) {
    masterRef.current = null;
    return null;
  }

  const roundsWithExtras = produce(data.rounds, draft => {
    const unassignedPuzzles = Object.keys(data.puzzles).filter(slug => !data.puzzles[slug].rounds.filter(round => data.rounds[round]?.hidden === false).length);
    if (unassignedPuzzles.length) draft['_unassigned'] = {
      slug: '_unassigned',
      name: 'Unassigned',
      hidden: false,
      puzzles: unassignedPuzzles,
      is_pseudoround: true,
    } as Model.Round;
    const metas = Object.keys(data.puzzles).filter(slug => data.puzzles[slug].hidden === false && data.puzzles[slug].is_meta);
    if (metas.length) draft['_metas'] = {
      slug: '_metas',
      name: 'Metas',
      hidden: false,
      puzzles: metas,
      is_pseudoround: true,
    } as Model.Round;
  });

  const maxRoundTags = Math.max(...Object.values(data.rounds).map(round => round.round_tags?.length ?? 0));
  const numTotalTagColumns = Math.max(maxRoundTags + 1, numTagsWithEditing);
  const orderedRoundEntries = sortNewRoundsFirst ? Object.entries(roundsWithExtras).reverse() : Object.entries(roundsWithExtras);
  let rows = orderedRoundEntries.filter(([slug, round]) => round?.hidden === false).map(([slug, round]) => {
    const roundTags = round?.round_tags ?? null;
    return [
      {
        key: round.slug,
        Component: Round,
        props: {
          data: data,
          round: round,
          roundTags: roundTags,
          editable: editable,
          setNumTagsWithEditing: setNumTagsWithEditing,
          numTotalTagColumns: numTotalTagColumns,
        },
      },
      ...orderBy(round.puzzles.map(_slug => data.puzzles[_slug]).filter(puzzle => puzzle?.hidden === false && (!hideSolved || !Model.isSolved(puzzle))), ['is_meta'], ['desc']).map(puzzle => (
        {
          key: `${round.slug}--${puzzle.slug}`,
          Component: Puzzle,
          props: {
            puzzle: puzzle,
            round: round.slug,
            roundTags: roundTags,
            loadSlug: loadSlug,
            statuses: statuses,
            colors: colors,
            isPseudoround: round.is_pseudoround,
            editable: editable,
          },
        }
      )),
    ];
  }).flat();

  const rowHeight = masterRef.current ? masterRef.current.scrollHeight / Math.max(1, rows.length) : 28;
  const padding = masterRef.current && yDims.scrollHeight ? yDims.scrollHeight - masterRef.current.scrollHeight : 0;
  const buffer = 0.5;
  const y0 = yDims.scrollTop - padding - buffer * yDims.height;
  const y1 = yDims.scrollTop + padding + (1 + buffer) * yDims.height;

  return (
    <div className='master' ref={masterRef}>
      <Table className='sub-master'>
        <Tbody className='sub-master'>
          {SizingRow({
            maxRoundTags: Math.max(maxRoundTags, numTagsWithEditing),
            hasExtra: editable && numTagsWithEditing <= maxRoundTags,
          })}
          {rows.map(({Component, key, props}, i) => (
            <Component
              key={key}
              visible={y0 <= i * rowHeight && (i + 1) * rowHeight <= y1}
              {...props}
            />
          ))}
        </Tbody>
      </Table>
      <datalist id='master-status-options'>
        {Object.keys(statuses).map(option => <option key={option} value={option}/>)}
      </datalist>
    </div>
  );
};

export default Master;
