import React from 'react';

import * as Model from 'components/model';
import { HideIf } from 'components/frames';

interface PuzzleProps {
  isActive: boolean;
  slug: string;
  puzzleData: Model.Puzzle;
}

const Puzzle : React.FC<PuzzleProps> = ({
  isActive,
  slug,
  puzzleData,
}) => {
  return (
    <HideIf condition={!isActive}>
      {puzzleData ?
        <h1>Puzzle Page</h1>
        :
        <p>This puzzle does not exist. Maybe it was deleted?</p>
      }
    </HideIf>
  );
};

export default Puzzle;
