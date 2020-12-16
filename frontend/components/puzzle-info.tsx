import React from 'react';

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
          <a target="_blank" href={puzzle.link}><sup><CornerRightUp size={16}/></sup></a>
        }
      </h2>
      <Feeds title="Round" slugs={puzzle?.rounds} data={data.rounds}/>
      {(puzzle?.metas?.length || !puzzle?.is_meta || null) &&
      <Feeds title="Meta" slugs={puzzle?.metas} data={data.puzzles} prefix="/puzzles/" loadSlug={loadSlug}/>
      }
    </>
  );
};

export default PuzzleInfo;
