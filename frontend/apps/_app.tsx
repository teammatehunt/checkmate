import React from 'react'
import ReactDOM from 'react-dom'

const reactMount = (PageComponent, props, mountElement) => {
  ReactDOM.render(
    <PageComponent {...props}/>,
    mountElement,
  );
}
export default reactMount;
