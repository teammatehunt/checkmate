import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
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
import {
  EditState,
  TdEditable,
} from 'components/td-editable';
import Twemoji from 'components/twemoji';
import { patch } from 'utils/fetch';
import * as Model from 'utils/model';

import 'style/master.css';

const emptyRow = () => {
  return (
    <div className='tr sub-master'/>
  );
};

interface RoundProps {
  round: Model.Round;
  roundTags: string[] | null;
  visible: boolean;
}

const Round : React.FC<RoundProps> = React.memo(({
  round,
  roundTags,
  visible,
}) => {
  // Round is always visible (we need it because it is sticky)
  return (
    <div className={`tr sub-master round ${round.is_pseudoround ? 'pseudoround' : ''}`}>
      <div className='th sub-master name'><div>
        <Twemoji>
          {round.name}
        </Twemoji>
      </div></div>
      <div className='th sub-master answer'><div>Answer</div></div>
      <div className='th sub-master status'><div>Status</div></div>
      <div className='th sub-master notes'><div>Notes</div></div>
      <div className='th sub-master open-for'><div>Open For</div></div>
      {(roundTags || []).map(tag => (
        <div key={tag} className='th sub-master tag capitalize'><div>{tag}</div></div>
      ))}
    </div>
  );
});

interface PuzzleProps {
  puzzle: Model.Puzzle;
  roundTags: string[] | null;
  loadSlug: any;
  statuses: {[status: string]: string};
  colors: {[value: string]: string};
  isPseudoround?: boolean;
  visible: boolean;
}

const Puzzle : React.FC<PuzzleProps> = React.memo(({
  puzzle,
  roundTags,
  loadSlug,
  statuses,
  colors,
  isPseudoround,
  visible,
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

  const now = Date.now();
  const hasCreated = puzzle.created ?? undefined !== undefined;
  const hasSolved = puzzle.solved ?? undefined !== undefined;
  const createdTimestamp = hasCreated ? Date.parse(puzzle.created) : now;
  const solvedTimestamp = hasSolved ? Date.parse(puzzle.solved) : now;
  const duration = solvedTimestamp - createdTimestamp;
  const humanDuration = duration < 60 * 1000 ? 'just now' : humanizeDuration(
    duration,
    {
      largest: 2,
      units: ['y', 'mo', 'd', 'h', 'm'],
      round: true,
    },
  );
  const openForStyle = useMemo(() => Model.isSolved(puzzle, colors) ? {backgroundColor: colors?.solved} : undefined, [puzzle, colors]);

  if (!visible) return emptyRow();

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
      {(roundTags || []).map(tag => (
        <div key={tag} className='td sub-master'><div>{puzzle.tags[tag] ?? ''}</div></div>
      ))}
    </div>
  );
});


interface MasterProps {
  isActive: boolean;
  data: Model.Data;
  loadSlug: any;
  statuses: {[status: string]: string};
  colors: {[value: string]: string};
  hideSolved: boolean;
  yDims: {[key: string]: number};
}

const Master : React.FC<MasterProps> = ({
  isActive,
  data,
  loadSlug,
  statuses,
  colors,
  hideSolved,
  yDims,
}) => {
  const masterRef = useRef(null);

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
  const rows = Object.entries(roundsWithExtras).filter(([slug, round]) => round?.hidden === false).map(([slug, round]) => {
    const roundTags = round?.tagNames ?? null;
    return [
      {
        key: round.slug,
        Component: Round,
        props: {
          round: round,
          roundTags: roundTags,
        },
      },
      ...orderBy(round.puzzles.map(_slug => data.puzzles[_slug]).filter(puzzle => puzzle?.hidden === false && (!hideSolved || !Model.isSolved(puzzle, colors))), ['is_meta'], ['desc']).map(puzzle => (
        {
          key: `${round.slug}--${puzzle.slug}`,
          Component: Puzzle,
          props: {
            puzzle: puzzle,
            roundTags: roundTags,
            loadSlug: loadSlug,
            statuses: statuses,
            colors: colors,
            isPseudoround: round.is_pseudoround,
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
