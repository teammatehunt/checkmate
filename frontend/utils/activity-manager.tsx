import React, {
  useCallback,
  useMemo,
  useReducer,
} from 'react';

import produce from 'immer';

import { User } from 'components/react-feather';

import 'style/activity-manager.css';

export const Avatar = (user, activity) => {
  const discordData = user?.socialaccount?.[0]?.extra_data;
  const src = discordData?.avatar ?
    `https://cdn.discordapp.com/avatars/${discordData.id}/${discordData.avatar}.png`
      :
      discordData?.discriminator ?
      `https://cdn.discordapp.com/embed/avatars/${discordData.discriminator % 5}.png`
        :
        null;
  return (
    <div
      key={`${user?.uid}-${activity.tab}`}
      data-tip
      data-place='below'
      aria-label={user?.username}
      className='avatar-container'
    >
      {src ?
        <img className='avatar' src={src}/>
        :
        <User className='avatar'/>
      }
    </div>
  );
};

// uid and tab together form a primary key
export interface Activity {
  uid: number;
  tab: number;
  puzzle: string;
  ts?: number;
  origTs?: number;
}

const useActivityManager = () : [{[slug: string]: Activity[]}, (Activity) => void] => {
  const ttl = 3 * 60 * 1000; // 3 minutes
  const [items, dispatchActivity] = useReducer((items, action) => {
    const now = performance.now();
    let activity = action ? {...action, ts: now} : null;
    const thresh = now - ttl;
    const oldActivity = items.filter(x => x.uid === activity?.uid && x.tab === activity?.tab)[0];
    let newItems = null;
    if (activity && oldActivity) {
      activity.origTs = oldActivity.origTs;
      const mappedItems = items.map(x => x.uid === activity?.uid && x.tab === activity?.tab ? activity : x);
      newItems = mappedItems.filter(x => x.ts > thresh);
    } else {
      const filteredItems = items.filter(x => x.ts > thresh && !(x.uid === activity?.uid && x.tab === activity?.tab));
      if (activity) {
        activity.origTs = now;
        newItems = [...filteredItems, activity];
      } else {
        newItems = filteredItems.length === items.length ? items : filteredItems;
      }
    }
    return newItems;
  }, []);

  const byPuzzle = useMemo(() => {
    let byPuzzle = {};
    items.forEach(item => {
      if (item.puzzle ?? undefined !== undefined) {
        byPuzzle[item.puzzle] = byPuzzle[item.puzzle] ?? [];
        byPuzzle[item.puzzle].push(item);
      }
    });
    return byPuzzle;
  }, [items]);

  return [byPuzzle, dispatchActivity];
};

export default useActivityManager;
