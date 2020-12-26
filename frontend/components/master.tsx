import React from 'react';

import produce from 'immer';
import _ from 'lodash';
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

interface RoundProps {
  round: Model.Round;
  roundTags: string[];
}

const Round = ({
  round,
  roundTags,
}) => {
  return (
    <Tr className={`round ${round.is_pseudoround ? 'pseudoround' : ''}`}>
      <Th className='name'>
        <Twemoji>
          {round.name}
        </Twemoji>
      </Th>
      <Th>Answer</Th>
      <Th>Status</Th>
      <Th>Notes</Th>
      <Th>Open For</Th>
      {roundTags.map(tag => (
        <Th key={tag} className='capitalize'>{tag}</Th>
      ))}
    </Tr>
  );
};

interface PuzzleProps {
  puzzle: Model.Puzzle;
  roundTags: string[];
  loadSlug: any;
  statuses: {[status: string]: string};
  colors: {[value: string]: string};
  isPseudoround?: boolean;
}

const Puzzle : React.FC<PuzzleProps>= ({
  puzzle,
  roundTags,
  loadSlug,
  statuses,
  colors,
  isPseudoround,
}) => {
  const patchValue = (key, isTags=false) => {
    return async (value) => {
      const _data = !isTags ? {[key]: value} : {tags: produce(puzzle.tags, draft => {
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
  const humanDuration = duration < 60 * 1000 ? 'just now' : humanizeDuration(
    duration,
    {
      largest: 2,
      units: ['y', 'mo', 'd', 'h', 'm'],
      round: true,
    },
  );
  const openForStyle = Model.isSolved(puzzle, colors) ? {backgroundColor: colors?.solved} : undefined;

  return (
    <Tr className={`puzzle ${puzzle.is_meta ? 'meta' : ''} ${isPseudoround ? 'pseudoround' : ''}`}>
      <Td className='name'>
        <Link
          className='restyle'
          href={`/puzzles/${puzzle.slug}`}
          load={() => loadSlug(puzzle.slug)}
        >
          <Twemoji>
            {puzzle.is_meta ? <span className='metatag'/> : null}{puzzle.name}
          </Twemoji>
        </Link>
      </Td>
      <TdEditable
        className='answerize answer'
        value={puzzle.answer}
        patch={patchValue('answer')}
      />
      <TdEditable
        value={puzzle.status}
        patch={patchValue('status')}
        options={Object.keys(statuses)}
        colors={statuses}
      />
      <TdEditable
        className='notes'
        value={puzzle.notes}
        patch={patchValue('notes')}
        textarea
        expandTextarea={false}
      />
      <Td className='open-for' style={openForStyle}>
        {hasCreated ? humanDuration : null}
      </Td>
      {roundTags.map(tag => (
        <Td key={tag}>{puzzle.tags[tag] ?? ''}</Td>
      ))}
    </Tr>
  );
};

interface MasterProps {
  isActive: boolean;
  data: Model.Data;
  loadSlug: any;
  statuses: {[status: string]: string};
  colors: {[value: string]: string};
  hideSolved: boolean;
}

const Master : React.FC<MasterProps> = ({
  isActive,
  data,
  loadSlug,
  statuses,
  colors,
  hideSolved,
}) => {
  if (!isActive) return null;
  const roundsWithExtras = produce(data.rounds, draft => {
    const unassignedPuzzles = Object.keys(data.puzzles).filter(slug => !data.puzzles[slug].rounds.filter(round => data.rounds[round]?.hidden === false).length);
    if (unassignedPuzzles.length) draft['_unassigned'] = {
      name: 'Unassigned',
      hidden: false,
      puzzles: unassignedPuzzles,
      is_pseudoround: true,
    } as Model.Round;
    const metas = Object.keys(data.puzzles).filter(slug => data.puzzles[slug].hidden === false && data.puzzles[slug].is_meta);
    if (metas.length) draft['_metas'] = {
      name: 'Metas',
      hidden: false,
      puzzles: metas,
      is_pseudoround: true,
    } as Model.Round;
  });
  return (
    <div className='master'>
      <Table>
        <Tbody>
          {Object.entries(roundsWithExtras).filter(([slug, round]) => round.hidden === false).map(([slug, round]) => {
            const roundTags = [];
            return (
              <React.Fragment key={slug}>
                <Round key={slug} round={round} roundTags={roundTags}/>
                {_.orderBy(round.puzzles.map(_slug => data.puzzles[_slug]).filter(puzzle => puzzle.hidden === false && (!hideSolved || !Model.isSolved(puzzle, colors))), ['is_meta'], ['desc']).map(puzzle => (
                  <Puzzle
                    key={`${slug}::${puzzle.slug}`}
                    puzzle={puzzle}
                    roundTags={roundTags}
                    loadSlug={loadSlug}
                    statuses={statuses}
                    colors={colors}
                    isPseudoround={round.is_pseudoround}
                  />
                ))}
              </React.Fragment>
            );
          })}
        </Tbody>
      </Table>
    </div>
  );
};

export default Master;
