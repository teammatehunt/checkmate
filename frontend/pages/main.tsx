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
import { ShowIf } from 'components/frames';

import 'style/layout.css';

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
    <Context.SiteContextProvider huntConfig={data.hunt}>
      <Base>
        <div className="root vflex">
          <h1>Main Page</h1>
          <ShowIf condition={page === 'master'} className="vflex">
            <Master
              isActive={page === 'master'}
              data={data}
            />
          </ShowIf>
          <ShowIf condition={page === 'puzzle'} className="vflex">
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
          </ShowIf>
        </div>
      </Base>
    </Context.SiteContextProvider>
  );
};

export default mountElement(Main);
