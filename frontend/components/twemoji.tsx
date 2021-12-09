import {
  useEffect,
  useRef,
} from 'react';
import twemoji from 'twemoji';

const options = {
  folder: 'svg',
  ext: '.svg',
};

interface TwemojiProps {
  children: string;
  [_: string]: any;
}

/*
 * The children to this component should be a string, not React components.
 */
export const Twemoji : React.FC<TwemojiProps> = ({children, ...rest}) => {
  const ref = useRef<HTMLElement>(null);
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
