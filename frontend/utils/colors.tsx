export const solvedStatuses = [
  'solved',
  'backsolved',
  'bought',
];

export const blockedStatuses = [
  'blocked',
];

export const statuses = {
  new: 'whitesmoke',
  working: 'lightgray',
  extraction: 'orange',
  stuck: 'red',
  solved: 'lime',
  abandoned: 'pink',
  event: '^magenta',
  'claimed offline': 'khaki',
  backsolved: 'lime',
  bought: 'lime',
  blocked: '^gray',
};


const colors = {
  // statuses
  ...statuses,
  // colors
  red: 'red',
  orange: 'orange',
  yellow: 'yellow',
  green: 'limegreen',
  blue: '^blue',
  purple: '^rebeccapurple',
  indigo: '^indigo',
  violet: '^darkviolet',
  magenta: '^magenta',
  cyan: 'cyan',
  white: 'whitesmoke',
  gray: '^gray',
  grey: '^grey',
  pink: 'pink',
  brown: '^saddlebrown',
  black: '^black',
  gold: 'gold',
  silver: 'silver',
  // elements
  fire: 'red',
  water: 'aqua',
  wind: 'lightgreen',
  earth: '^peru',
  air: 'whitesmoke',
  // pokemon
  normal: 'beige',
  fighting: '^firebrick',
  flying: '^mediumpurple',
  poison: '^purple',
  ground: '^peru',
  rock: '^saddlebrown',
  bug: 'limegreen',
  ghost: '^darkviolet',
  steel: '^slategray',
  // fire
  // water
  grass: 'lime',
  electric: 'yellow',
  psychic: 'hotpink',
  ice: 'lightblue',
  dragon: '^indigo',
  dark: '^darkslategray',
  fairy: 'pink',
};
export default colors;
