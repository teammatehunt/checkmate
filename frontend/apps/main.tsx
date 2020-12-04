import React, {
  FunctionComponent,
} from 'react';

import Base from 'components/base';
import * as Model from 'components/model';

interface Props {
  page: string;
  data: any;
  slug?: string;
}

const Main : FunctionComponent<Props> = ({
  page,
  data,
  slug,
}) => {
  return (
    <Base>
      <h1>Main Page</h1>
    </Base>
  );
}

export default Main;
