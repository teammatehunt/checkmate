import React, {
  useEffect,
  useState,
} from 'react';

import { CornerRightUp } from 'react-feather';

import * as Model from 'utils/model';

import 'style/puzzleinfo.css';

const Feeds = ({title, slugs, data, prefix, loadSlug} : {title, slugs, data, prefix?, loadSlug?}) => (
  <div className={`feeds-${title}`}>
    <span className={`title-${title}`}>{title}:</span>{' '}
    {slugs?.map((slug, i) => (
      <>
        {i ? <span key={`delimiter-${i}`}>, </span> : null}
        <span key={slug}>
          <a {...(prefix === undefined ? {} : {
            href: `${prefix}${slug}`,
            onClick: function(e) {
              if (e.altKey || e.ctrlKey || e.shiftKey) return;
              if (loadSlug) {
                e.preventDefault();
                loadSlug(slug);
              }
            },
          })}>
            {data[slug]?.name}
          </a>
        </span>
      </>
    ))}
  </div>
);

interface TextFieldProps {
  name: string;
  value: string;
  options?: string[];
}

const TextField : React.FC<TextFieldProps> = ({
  name,
  value,
  options,
}) => {
  const [localValue, setLocalValue] = useState(value || '');
  const [editState, setEditState] = useState(false);
  useEffect(() => {
    if (!editState) setLocalValue(value);
  }, [value, editState]);
  return (
    <tr key={name}>
      <td className='puzzle-info-key'>{name}:</td>
      <td>{localValue}</td>
    </tr>
  );
};

interface PuzzleInfoProps {
  data: Model.Data;
  slug: string;
  loadSlug: any;
}

const PuzzleInfo : React.FC<PuzzleInfoProps> = ({
  data,
  slug,
  loadSlug,
}) => {
  const puzzle = data.puzzles[slug];
  if (!puzzle) return null;
  return (
    <>
      <h2>
        {puzzle?.name}
        {puzzle?.link &&
          <a target='_blank' href={puzzle.link}><sup><CornerRightUp size={16}/></sup></a>
        }
      </h2>
      <Feeds title='Round' slugs={puzzle?.rounds} data={data.rounds}/>
      {(puzzle?.metas?.length || !puzzle?.is_meta || null) &&
      <Feeds title='Meta' slugs={puzzle?.metas} data={data.puzzles} prefix='/puzzles/' loadSlug={loadSlug}/>
      }
      <table>
        <tbody>
          <TextField name='answer' value={puzzle?.answer}/>
          <TextField name='status' value={puzzle?.status}/>
          {Object.keys(puzzle?.tags || {}).sort().map(tag => (
            <TextField name={tag} value={puzzle.tags[tag]}/>
          ))}
          <TextField name='notes' value={puzzle?.notes}/>
        </tbody>
      </table>
    </>
  );
};

export default PuzzleInfo;
