import React from 'react';

import * as Model from 'components/model';

interface MasterProps {
  isActive: boolean;
  data: Model.Data;
}

const Master : React.FC<MasterProps> = ({
  isActive,
  data,
}) => {
  if (!isActive) return null;
  return (
    <h2>Master Page</h2>
  );
};

export default Master;
