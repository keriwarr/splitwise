/**
 * OAuth 2.0 Client Credentials grant for Splitwise.
 *
 * This is the simplest server-to-server flow: exchange your app's client_id
 * and client_secret for an access token that acts on behalf of the app owner.
 */

import { postTokenRequest, type PostTokenRequestOptions } from './internal.js';
import type { ClientCredentialsParams, OAuthToken } from './types.js';

export async function fetchClientCredentialsToken(
  params: ClientCredentialsParams,
  options: PostTokenRequestOptions = {},
): Promise<OAuthToken> {
  return postTokenRequest(
    {
      grant_type: 'client_credentials',
      client_id: params.clientId,
      client_secret: params.clientSecret,
    },
    options,
  );
}
