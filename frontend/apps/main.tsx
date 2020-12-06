import React, {
  FC,
  useReducer,
  useState,
} from 'react';

import mountElement from 'utils/mount';
import Base from 'components/base';
import * as Model from 'components/model';

interface Props {
  page: string;
  data: Model.Data;
  slug?: string;
}

export const Main : FC<Props> = props => {
  const [page, setPage] = useState(props.page);
  const [slug, setSlug] = useState(props.slug);
  const [data, dataDispatch] = useReducer(Model.dataReducer, props.data);
  return (
    <Base>
      <h1>Main Page</h1>
    </Base>
  );
}

export default mountElement(Main);
