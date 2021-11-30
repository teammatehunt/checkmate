import React, {
  forwardRef,
} from 'react';

import 'style/drop-ins.css';

export const GhostX = () => (
  <div className='ghost-x'>x</div>
);

const divInsertClass = (_class : string) => (props) => {
  const {className, children, ...rest} = props;
  return (
    <div className={`${_class} ${className ?? ''}`} {...rest}>
      {children}
    </div>
  );
};

export const Table = divInsertClass('table');
export const Tr = divInsertClass('tr');
export const Thead = divInsertClass('thead');
export const Tbody = divInsertClass('tbody');
export const Tfoot = divInsertClass('tfoot');
export const Col = divInsertClass('col');
export const Colgroup = divInsertClass('colgroup');
export const Td = divInsertClass('td');
export const Th = divInsertClass('th');
export const Caption = divInsertClass('caption');

export const Link = (props) => {
  const {load, className, children, ...rest} = props;
  const clickable = !!(load || rest.href || rest.onClick);
  return (
    <a
      className={`${clickable ? 'clickable' : ''} ${className || ''}`}
      onClick={(e) => {
        if (e.altKey || e.ctrlKey || e.shiftKey) return;
        if (load) {
          e.preventDefault();
          load(e);
        }
      }}
      {...rest}
    >
      {children}
    </a>
  );
};

const inputOnKeyDown = (e) => {
  switch (e.key) {
    case 'Enter':
      if (!(e.target.tagName.toLowerCase() === 'textarea' && e.shiftKey)) e.target.blur();
    break;
    case 'Escape':
      // firefox doesn't blur on escape automatically
      e.target.blur();
    break;
  }
};
export const Input = forwardRef<any, any>((props, ref) => {
  const {textarea, ...rest} = props;
  const Element = textarea ? 'textarea' : 'input';
  const onKeyDown = props.onKeyDown || inputOnKeyDown;
  return (
    <Element
      ref={ref}
      type='text'
      onKeyDown={onKeyDown}
      {...rest}
    />
  );
});
// FunctionalInput can be used to reduce one level of the React tree
export const FunctionalInput = ({ref, ...props}) => {
  const {textarea, ...rest} = props;
  const Element = textarea ? 'textarea' : 'input';
  const onKeyDown = props.onKeyDown || inputOnKeyDown;
  return (
    <Element
      ref={ref}
      type='text'
      onKeyDown={onKeyDown}
      {...rest}
    />
  );
};
