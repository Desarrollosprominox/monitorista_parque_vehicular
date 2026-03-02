import { useCallback, useState, useEffect } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { loginRequest, identityRequest } from '../config/authConfig';
import { DATAVERSE_API_ENDPOINT } from '../config/constants';
import { useLocation, useNavigate } from 'react-router-dom';

export function useAuth() {
  const { instance, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState(() => {
    try { return localStorage.getItem('app.role') || null; } catch { return null; }
  });
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Log del rol cuando cambie (diagnóstico)
  useEffect(() => {
    if (role !== null) {
      console.info('[Auth] Rol actual del usuario:', role);
    }
  }, [role]);

  useEffect(() => {
    if (inProgress === InteractionStatus.None) {
      setIsLoading(false);
      try {
        const path = location?.pathname || '/';
        if (isAuthenticated && (path === '/' || path === '/login')) {
          navigate('/home', { replace: true });
        }
      } catch {}
    }
  }, [inProgress, isAuthenticated, location, navigate]);

  const login = useCallback(async () => {
    try {
      if (inProgress === InteractionStatus.None) {
        console.info('[Auth] Iniciando loginRedirect con scopes mínimos de identidad…');
        setIsLoading(true);
        await instance.loginRedirect(identityRequest);
      }
    } catch (error) {
      console.error('Login failed:', error);
      setError(error);
      setIsLoading(false);
      throw error;
    }
  }, [instance, inProgress]);

  const logout = useCallback(async () => {
    try {
      if (inProgress === InteractionStatus.None) {
        console.info('[Auth] Iniciando logoutRedirect…');
        setIsLoading(true);
        await instance.logoutRedirect({
          postLogoutRedirectUri: window.location.origin,
        });
      }
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoading(false);
      throw error;
    }
  }, [instance, inProgress]);

  const getAccessToken = useCallback(async () => {
    try {
      if (inProgress === InteractionStatus.None && isAuthenticated) {
        console.debug('[Auth] acquireTokenSilent start…');
        setIsLoading(true);
        const response = await instance.acquireTokenSilent({
          ...loginRequest,
          account: instance.getAllAccounts()[0]
        });
        console.debug('[Auth] acquireTokenSilent success');
        setIsLoading(false);
        return response.accessToken;
      }
    } catch (error) {
      console.warn('[Auth] acquireTokenSilent error:', error?.errorCode || error?.message || error);
      setError(error);
      const code = String(error?.errorCode || '').toLowerCase();
      const message = String(error?.message || '').toLowerCase();
      const needsInteraction =
        code.includes('interaction_required') ||
        code.includes('consent_required') ||
        code.includes('login_required') ||
        code.includes('invalid_grant') ||
        message.includes('interaction required') ||
        message.includes('consent required') ||
        message.includes('login required');
      if (needsInteraction) {
        console.info('[Auth] Requiere interacción: lanzando acquireTokenRedirect con prompt=consent…');
        await instance.acquireTokenRedirect({ ...loginRequest, prompt: 'consent' });
        return null;
      }
      setIsLoading(false);
      throw error;
    }
  }, [instance, inProgress, isAuthenticated]);

  // Carga/actualiza el rol del usuario desde amv_rols comparando amv_correo
  const refreshRole = useCallback(async () => {
    try {
      const account = instance.getAllAccounts()[0];
      if (!account) { setRole(null); return null; }
      const email = (account.username || (account?.idTokenClaims && (account.idTokenClaims.preferred_username || account.idTokenClaims.email)) || '').toLowerCase();
      if (!email) { setRole(null); return null; }
      const tokenResp = await instance.acquireTokenSilent({ ...loginRequest, account });
      const accessToken = tokenResp.accessToken;
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
      };
      const safe = email.replace(/'/g, "''");
      // Probar diferentes nombres de entity set por pluralización
      const sets = ['amv_rols', 'amv_roles', 'amv_rolses', 'amv_rol'];
      let resolved = null;
      for (const set of sets) {
        // 1) igualdad exacta (evita tolower() -> algunos entornos responden 501)
        let url = `${DATAVERSE_API_ENDPOINT}/${set}?$select=amv_rol,amv_correo&$filter=amv_correo eq '${safe}'&$top=1`;
        console.debug('[Auth] Resolviendo rol en', set, 'con filtro exacto…');
        let resp = await fetch(encodeURI(url), { headers });
        if (!resp.ok) {
          // 2) fallback: contains por si el correo guardado difiere en mayúsculas/minúsculas
          url = `${DATAVERSE_API_ENDPOINT}/${set}?$select=amv_rol,amv_correo&$filter=contains(amv_correo,'${safe}')&$top=1`;
          console.debug('[Auth] Fallback contains() en', set);
          resp = await fetch(encodeURI(url), { headers });
        }
        if (!resp.ok) {
          console.warn('[Auth] No se pudo consultar', set, 'status:', resp.status);
          continue;
        }
        const data = await resp.json();
        const row = Array.isArray(data?.value) && data.value.length ? data.value[0] : null;
        if (!row?.amv_rol) continue;
        const raw = String(row.amv_rol).toLowerCase();
        if (raw.includes('admin')) resolved = 'admin';
        else if (raw.includes('monitor')) resolved = 'monitorista';
        else resolved = raw || null;
        console.info('[Auth] Rol resuelto desde', set, ':', resolved);
        break;
      }
      setRole(resolved);
      try { localStorage.setItem('app.role', resolved || ''); } catch {}
      return resolved;
    } catch (e) {
      console.warn('[useAuth.refreshRole] error:', e?.message || e);
      setRole(null);
      try { localStorage.removeItem('app.role'); } catch {}
      return null;
    }
  }, [instance]);

  // Intentar cargar el rol cuando el usuario está autenticado y MSAL está listo
  useEffect(() => {
    if (inProgress === InteractionStatus.None && isAuthenticated) {
      refreshRole();
    }
  }, [inProgress, isAuthenticated, refreshRole]);

  return {
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    getAccessToken,
    user: instance.getAllAccounts()[0] || null,
    role,
    refreshRole,
  };
} 