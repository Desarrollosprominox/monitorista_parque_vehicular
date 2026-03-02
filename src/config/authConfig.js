import { LogLevel } from '@azure/msal-browser';

// Variables de entorno (Vite) con valores por defecto seguros
const {
    VITE_AZURE_CLIENT_ID,
    VITE_AZURE_TENANT_ID,
    VITE_AZURE_REDIRECT_URI,
    VITE_AZURE_SCOPE,
} = import.meta.env || {};

const DEFAULT_CLIENT_ID = 'c375a4d8-9cc9-44d1-81f9-5121aee042a5'; // Se puede sobrescribir por VITE_AZURE_CLIENT_ID
const DEFAULT_TENANT_ID = 'dcbc0cef-7e0e-4841-9a93-633aa4c88bbf';
const DEFAULT_REDIRECT_URI = typeof window !== 'undefined' ? window.location.origin : '/';
const DEFAULT_SCOPE = 'https://orgb392fb43.crm.dynamics.com/user_impersonation';

const clientId = VITE_AZURE_CLIENT_ID || DEFAULT_CLIENT_ID;
const tenantId = VITE_AZURE_TENANT_ID || DEFAULT_TENANT_ID;
const redirectUri = VITE_AZURE_REDIRECT_URI || DEFAULT_REDIRECT_URI;
const dataverseScope = VITE_AZURE_SCOPE || DEFAULT_SCOPE;
const authority = `https://login.microsoftonline.com/${tenantId}`;

export const msalConfig = {
	auth: {
		clientId,
		authority,
		redirectUri,
		postLogoutRedirectUri: redirectUri,
		navigateToLoginRequestUrl: true,
		clientCapabilities: ['CP1'],
	},
	cache: {
		cacheLocation: 'sessionStorage',
		storeAuthStateInCookie: false,
	},
	system: {
		allowNativeBroker: false,
		allowRedirectInIframe: false,
		loggerOptions: {
			loggerCallback: (level, message, containsPii) => {
				if (containsPii) return;
				if (level === LogLevel.Error) console.error(message);
				if (level === LogLevel.Warning) console.warn(message);
				// Reducir ruido en móvil: Info/Verbose no se muestran
			},
			piiLoggingEnabled: false,
			logLevel: LogLevel.Warning,
		}
	}
};

// Scopes mínimos de identidad para el login interactivo
export const identityRequest = {
	scopes: ['openid', 'profile', 'email'],
};

// Permisos para Dataverse (se obtiene en segundo plano con acquireTokenSilent)
export const loginRequest = {
	scopes: [dataverseScope]
};

// For accessing Dynamics 365 API
export const apiConfig = {
    baseUrl: "https://orgb392fb43.crm.dynamics.com/api/data/v9.2"
};

// Las entradas siguientes parecen heredadas; se conservan por compatibilidad, aunque no se usan en la app actual.
export const tokenRequest = { scopes: ["User.Read", "Mail.Read"] };
export const graphConfig = { graphMeEndpoint: "https://orgb392fb43.crm.dynamics.com/api/data/v9.2" };