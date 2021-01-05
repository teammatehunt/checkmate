import produce from 'immer';

export const getCookie = (name) => {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      // Does this cookie string begin with the name we want?
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

export const FormCSRFToken = () => {
  const csrfToken = getCookie('csrftoken');
  return (
    <input type='hidden' name='csrfmiddlewaretoken' value={csrfToken}/>
  );
};

// kwargs should contain at least `method`
export const fetchJson = async ({url, data, ...kwargs}) => {
  return await fetch(url, {
    headers: {
      'X-CSRFToken': getCookie('csrftoken'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
    ...kwargs,
  });
};
export default fetchJson;

export const patch = async ({slug, data, type='puzzle'}) => {
  const url = `/api/${type}s/${slug}`;
  const response = await fetchJson({
    url: url,
    method: 'PATCH',
    data: data,
  });
  if (!response.ok) {
    // TODO: notify error
    console.error('PATCH request failed');
  }
  return response;
};
