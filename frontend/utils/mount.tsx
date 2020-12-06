import ReactDOM from 'react-dom';

const reactMount = (PageComponent) => {
  return (props, mountElement) => {
    ReactDOM.render(
      <PageComponent {...props}/>,
      mountElement,
    );
  };
}
export default reactMount;
