import BaseTwemoji from 'react-twemoji';

const Twemoji = ({children, options, ...props} : {children?, options?}) => {
  const _options = {
    folder: 'svg',
    ext: '.svg',
    ...options,
  };
  return (
    <BaseTwemoji tag='span' options={_options} {...props}>
      {children}
    </BaseTwemoji>
  );
};
export default Twemoji;
