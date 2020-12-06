import mountElement from 'utils/mount';
import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
} from 'react';

import { useLocalStorage } from '@rehooks/local-storage';

import * as Context from 'components/context';
import * as Model from 'components/model';
import Base from 'components/base';
import Master from 'components/master';
import Puzzle from 'components/puzzle';

interface MainProps {
  page: 'master' | 'puzzle';
  data: Model.Data;
  slug?: string;
}

export const Main : React.FC<MainProps> = props => {
  const [page, setPage] = useState(props.page);
  const [slug, setSlug] = useState(props.slug);
  const [data, dataDispatch] = useReducer(Model.dataReducer, props.data);

  const [tabs, setTabs, deleteTabs] = useLocalStorage<string[]>('main/puzzle-tabs', []);

  useEffect(() => {
    if (page === 'puzzle') {
      if (slug in data.puzzles && !tabs.includes(slug)) {
        setTabs([slug, ...tabs]);
      }
    }
  }, [slug]);

  return (
    <Base>
      <h1>Main Page</h1>
      <Master
        isActive={page === 'master'}
        data={data}
      />
      <Context.PuzzleContextProvider>
        {tabs.map(tab => (
          <Puzzle
            key={tab}
            isActive={page === 'puzzle' && tab === slug}
            slug={tab}
            puzzleData={data.puzzles[tab]}
          />
        ))}
      </Context.PuzzleContextProvider>
    </Base>
  );
};

export default mountElement(Main);
