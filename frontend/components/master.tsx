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
} from 'components/replacements';
import Twemoji from 'components/twemoji';
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
}

const Puzzle = ({
  puzzle,
  extraTags,
  loadSlug,
}) => {
  return (
    <Tr className={`puzzle ${puzzle.is_meta ? 'meta' : ''}`}>
      <Td className='name'>
        <Link
          href={`/puzzles/${puzzle.slug}`}
          load={() => loadSlug(puzzle.slug)}
        >
          <Twemoji>
            {puzzle.is_meta ? 'META: ' : ''}{puzzle.name}
          </Twemoji>
        </Link>
      </Td>
      <Td className='answerize'>{puzzle.answer}</Td>
      <Td>{puzzle.status}</Td>
      <Td>{puzzle.notes}</Td>
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
}

const Master : React.FC<MasterProps> = ({
  isActive,
  data,
  loadSlug,
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
