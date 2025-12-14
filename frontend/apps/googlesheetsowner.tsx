// filename without dash because of module naming
import mountElement from 'utils/mount';
import React, {
  useEffect,
  useState,
} from 'react';

import Base from 'components/base';
import * as Model from 'utils/model';

import 'style/global.css';
import 'style/layout.css';
import 'style/documentation.css';

interface SheetsOwnerProps {
  owner?: Model.SheetsOwner;
  csrfmiddlewaretoken: string;
}

export const SheetsOwner : React.FC<SheetsOwnerProps> = ({
  owner,
  csrfmiddlewaretoken,
}) => {
  return (
    <Base>
      <title>Google Sheets Owner</title>
      <div className='root'>
        <h1>Google Sheets Owner</h1>
        <p>
          Checkmate needs Google OAuth 2 credentials to create puzzle sheets owned by a Google user account. This is needed for custom functions to run in Sheets. Otherwise, the puzzle sheets will be created under a service account and will not be able to run custom functions.
        </p>
        <p>
          Use this to give Checkmate permissions as yourself to copy the sheet template for new puzzles. In the likely case that the Google OAuth client is unpublished, you will need to be on the list of test users (configured in GCP) to be able to add your credentials.
        </p>

        {
          !owner ?
            <p>Checkmate does not have valid Google user credentials.</p>
            :
            <>
              <p>
                Checkmate currently has the following user credentials:
                <br/>
                <strong>{owner.name} {'<'}{owner.email}{'>'}</strong>
              </p>
            </>
        }

        <form
          method="post"
          action="/accounts/google/login/?process=login"
        >
          <input type="hidden" name="csrfmiddlewaretoken" value={csrfmiddlewaretoken}/>
          <button type="submit">
            Click here to set new Google credentials
          </button>
        </form>

      </div>
    </Base>
  );
};

export default mountElement(SheetsOwner);
