import {
  useEffect,
  useRef,
} from 'react';
import twemoji from 'twemoji';

const options = {
  folder: 'svg',
  ext: '.svg',
};

export const Twemoji = ({children, ...rest}) => {
  const ref = useRef(null);
  useEffect(() => {
    twemoji.parse(ref.current, options);
  }, [children]);
  return (
    <span
      ref={ref}
      {...rest}
    >
      {children}
    </span>
  );
};
export default Twemoji;
