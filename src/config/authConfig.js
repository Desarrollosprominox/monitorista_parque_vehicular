import { LogLevel } from '@azure/msal-browser';

export const msalConfig = {
    auth: {
        clientId: "e90d1cae-ae26-45a3-80ca-9f28fe226c6b",
        authority: "https://login.microsoftonline.com/dcbc0cef-7e0e-4841-9a93-633aa4c88bbf",
        redirectUri: window.location.origin,
        postLogoutRedirectUri: window.location.origin,
        navigateToLoginRequestUrl: true,
    },
    cache: {
        cacheLocation: "localStorage",
        storeAuthStateInCookie: true,
    },
    system: {
        allowNativeBroker: false,
        loggerOptions: {
            loggerCallback: (level, message) => {
                if (level === LogLevel.Error) console.error(message);
                if (level === LogLevel.Warning) console.warn(message);
            },
            piiLoggingEnabled: false,
            logLevel: LogLevel.Error,
        }
    }
};

// Add Dynamics 365 API permissions
export const loginRequest = {
    scopes: ["https://orgb392fb43.crm.dynamics.com/user_impersonation"]
};

// For accessing Dynamics 365 API
export const apiConfig = {
    baseUrl: "https://orgb392fb43.crm.dynamics.com/api/data/v9.2"
};

export const tokenRequest = {
    scopes: ["User.Read", "Mail.Read"]
};

export const graphConfig = {
    graphMeEndpoint: "https://orgb392fb43.crm.dynamics.com/api/data/v9.2"
}; 