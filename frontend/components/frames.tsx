import React from 'react';

export const ShowIf = ({condition, children,  ...props}) => {
  let classes = props.className ? [props.className] : [];
  classes.push(condition ? 'active' : 'nodisplay');
  const className = classes.join(' ');
  return (
    <div {...props} className={className}>
      {children}
    </div>
  );
};
