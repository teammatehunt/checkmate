import React from 'react';

import produce from 'immer';
import _ from 'lodash';

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
  extraTags: string[];
}

const Round = ({
  round,
  extraTags,
}) => {
  return (
    <Tr className='round'>
      <Th className='name'>
        <Twemoji>
          {round.name}
        </Twemoji>
      </Th>
      <Th>Answer</Th>
      <Th>Status</Th>
      <Th>Notes</Th>
      {extraTags.map(tag => (
        <Th key={tag} className='capitalize'>{tag}</Th>
      ))}
    </Tr>
  );
};

interface PuzzleProps {
  puzzle: Model.Puzzle;
  extraTags: string[];
  loadSlug: any;
  statuses: {[status: string]: string};
  colors: {[value: string]: string};
}

const Puzzle : React.FC<PuzzleProps>= ({
  puzzle,
  extraTags,
  loadSlug,
  statuses,
  colors,
}) => {
  const patchValue = (key, isTags=false) => {
    return async (value) => {
      const _data = !isTags ? {[key]: value} : {tags: produce(puzzle.tags, draft => {
        draft[key] = value;
      })};
      return await patch({slug: puzzle.slug, data: _data});
    };
  };

  return (
    <Tr className={`puzzle ${puzzle.is_meta ? 'meta' : ''}`}>
      <Td className='name'>
        <Link
          className='restyle'
          href={`/puzzles/${puzzle.slug}`}
          load={() => loadSlug(puzzle.slug)}
        >
          <Twemoji>
            {puzzle.is_meta ? 'META: ' : ''}{puzzle.name}
          </Twemoji>
        </Link>
      </Td>
      <TdEditable
        className='answerize'
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
        value={puzzle.notes}
        patch={patchValue('notes')}
        textarea
        expandTextarea={false}
      />
      {extraTags.map(tag => (
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
}

const Master : React.FC<MasterProps> = ({
  isActive,
  data,
  loadSlug,
  statuses,
  colors,
}) => {
  if (!isActive) return null;
  const roundsWithUnassigned = produce(data.rounds, draft => {
    const unassignedPuzzles = Object.keys(data.puzzles).filter(slug => !data.puzzles[slug].rounds.filter(round => data.rounds[round]?.hidden === false).length);
    if (unassignedPuzzles.length) draft['unassigned'] = {
      name: 'Unassigned',
      hidden: false,
      puzzles: unassignedPuzzles,
    } as Model.Round;
  });
  return (
    <div className='master'>
      <Table>
        <Tbody>
          {Object.entries(roundsWithUnassigned).filter(([slug, round]) => round.hidden === false).map(([slug, round]) => {
            const extraTags = [];
            return (
              <>
                <Round key={`${slug}`} round={round} extraTags={extraTags}/>
                {_.orderBy(round.puzzles.map(_slug => data.puzzles[_slug]).filter(puzzle => puzzle.hidden === false), ['is_meta'], ['desc']).map(puzzle => (
                  <Puzzle
                    key={`${slug}::${puzzle.slug}`}
                    puzzle={puzzle}
                    extraTags={extraTags}
                    loadSlug={loadSlug}
                    statuses={statuses}
                    colors={colors}
                  />
                ))}
              </>
            );
          })}
        </Tbody>
      </Table>
    </div>
  );
};

export default Master;
