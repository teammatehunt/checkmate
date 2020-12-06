import produce, { Draft } from 'immer';

export interface HuntConfig {
  domain: string;
  auto_assign_puzzles_to_meta: boolean;
  discord_server_id: number;
}

export interface SocialAccount {
  provider: string;
  uid: string;
  extra_data: {
    id?: string;
    username?: string;
    discriminator?: string;
    avatar?: string;
    flags?: number;
    public_flags?: number;
    locale?: string;
    mfa_enabled?: boolean;
  };
}

export interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  socialaccounts: SocialAccount[];
}

export interface Entity {
  slug: string;
  name: string;
  link: string; // link to puzzle relative to hunt domain root
  created: string; // timestamp
  created_by: number; // User.id
  modified: string; // timestamp
  modified_by: number; // User.id
  hidden: boolean; // should ignore this and all references to this if hidden
  tags: any; // key value pairs

  discord_text_channel_id: number;
  discord_voice_channel_id: number;
  sheet_link: string; // full link
}

export interface Round extends Entity {
  auto_assign_puzzles_to_meta: boolean;

  puzzles: string[]; // puzzle slugs
}

export interface Puzzle extends Entity {
  solved: string; // timestamp
  solved_by: number; // User.id
  is_meta: boolean;

  answer: string;
  rounds: string[]; // round slugs
  metas: string[]; // meta slugs
  feeders: string[]; // feeder puzzle slugs
}

export interface Data {
  hunt: HuntConfig;
  users: {[id: number]: User};
  rounds: {[slug: string]: Round};
  round_order: string[];
  puzzles: {[slug: string]: Puzzle};
}

export const dataReducer = (state : Data, action : any) : Data => {
  return produce(state, (draft : Draft<Data>) => {
    switch (action.type) {
      case 'merge':
        return dataMerge(draft, action.data, action.roots);
        break;
      default:
        throw TypeError();
    }
  });
};

const dataMerge = (draft, data, roots) => {
  if (roots === true) return data;
  for (const key in roots) {
    const newData = dataMerge(draft[key], data[key], roots[key]);
    if (newData !== undefined) draft[key] = newData;
  }
};

export const discordLink = (server_id : number, channel_id : number) => `https://discord.com/channels/${server_id}/${channel_id}`;
