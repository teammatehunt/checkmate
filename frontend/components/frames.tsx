import React from 'react';

export const HideIf = ({condition, children}) => {
  return (
    <div className={condition ? 'nodisplay' : 'active'}>
      {children}
    </div>
  );
};
