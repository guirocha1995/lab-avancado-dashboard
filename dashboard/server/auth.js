/**
 * Microsoft Entra ID (Azure AD) Authentication Module
 *
 * Uses Client Credentials flow (OAuth 2.0) to obtain tokens for calling
 * APIs protected by Entra ID (e.g., APIM with validate-jwt policy).
 *
 * If AZURE_TENANT_ID is not configured, all functions gracefully return null,
 * allowing the lab to work without authentication.
 */

const { ClientSecretCredential } = require('@azure/identity');

let credential = null;
let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Initializes the ClientSecretCredential if Entra ID env vars are configured.
 * Returns null if not configured (graceful fallback).
 */
function getCredential() {
  if (credential) return credential;

  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    console.warn(
      'AZURE_TENANT_ID, AZURE_CLIENT_ID ou AZURE_CLIENT_SECRET nao configurados. ' +
        'Autenticacao OAuth 2.0 desabilitada (lab funcionara sem JWT).'
    );
    return null;
  }

  credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  return credential;
}

/**
 * Gets an OAuth 2.0 access token for the configured API scope.
 * Caches the token and refreshes it 5 minutes before expiration.
 *
 * @returns {Promise<string|null>} The access token, or null if auth is not configured.
 */
async function getAccessToken() {
  const cred = getCredential();
  if (!cred) return null;

  const scope = process.env.AZURE_API_SCOPE;
  if (!scope) {
    console.warn('AZURE_API_SCOPE nao configurado. Token OAuth 2.0 nao sera obtido.');
    return null;
  }

  // Return cached token if still valid (with 5-minute buffer)
  const now = Date.now();
  if (cachedToken && tokenExpiresAt - now > 5 * 60 * 1000) {
    return cachedToken;
  }

  try {
    const tokenResponse = await cred.getToken(scope);
    cachedToken = tokenResponse.token;
    tokenExpiresAt = tokenResponse.expiresOnTimestamp;
    console.log('Token OAuth 2.0 obtido com sucesso');
    return cachedToken;
  } catch (err) {
    console.error('Falha ao obter token OAuth 2.0:', err.message);
    return null;
  }
}

module.exports = { getAccessToken };
