import React, {
  useCallback,
  useMemo,
  useReducer,
} from 'react';

import produce from 'immer';

import { User } from 'components/react-feather';
import * as Model from 'utils/model';

import 'style/activity-manager.css';

export const Avatar = (user : Model.User, activity : Activity, huntConfig : Model.HuntConfig) => {
  const discordData = user?.socialaccount?.[0]?.extra_data;
  const src = discordData?.avatar ?
    `https://cdn.discordapp.com/avatars/${discordData.id}/${discordData.avatar}.png`
      :
      discordData?.discriminator ?
      `https://cdn.discordapp.com/embed/avatars/${Number(discordData.discriminator) % 5}.png`
        :
        null;
  const roleSet = new Set(discordData?.roles);
  let borderColor = 'transparent';
  for (const [roleId, color] of Object.entries(huntConfig.role_colors)) {
    if (roleSet.has(roleId)) {
      borderColor = color;
      break;
    }
  }
  return (
    <div
      key={`${activity.uid}-${activity.tab}`}
      data-tip
      data-place='below'
      aria-label={discordData?.nick ?? user?.username}
      className='avatar-container'
    >
      {src ?
        <img className='avatar' src={src} style={{borderColor}}/>
        :
        <User className='avatar' style={{borderColor}}/>
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
  const [items, dispatchActivity] = useReducer((items, activities) => {
    const now = performance.now();
    const thresh = now - ttl;
    let byId = {};
    for (const activity of activities) {
      byId[activity.uid] = byId[activity.uid] ?? {};
      byId[activity.uid][activity.tab] = activity;
    }
    let oldById = {};
    for (const activity of items) {
      oldById[activity.uid] = oldById[activity.uid] ?? {};
      oldById[activity.uid][activity.tab] = activity;
    }
    const mappedItems = items.map(x => {
      const newItem = byId[x.uid]?.[x.tab];
      if (newItem) {
        if (newItem.puzzle === x.puzzle) return {...x, ts: now};
        return null;
      } else {
        return x;
      }
    });
    const filteredItems = mappedItems.filter(x => x && x.ts > thresh);
    const newItems = [...filteredItems, ...activities.filter(activity => {
      const oldActivity = oldById[activity.uid]?.[activity.tab];
      if (byId[activity.uid][activity.tab] !== activity) return false;
      if (oldActivity && oldActivity.puzzle === activity.puzzle) return false;
      return true;
    }).map(activity => ({...activity, ts: now, tsOrig: now}))];
    if (activities.length || mappedItems.length !== filteredItems.length) {
      return newItems;
    } else {
      return items;
    }
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
