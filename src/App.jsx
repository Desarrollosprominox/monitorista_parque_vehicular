import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication, EventType } from '@azure/msal-browser';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { msalConfig } from './config/authConfig';
import Login from './components/Login';
import SolicitudesPendientes from './pages/solicitudespendientes';
import SolicitudesResueltas from './pages/SolicitudesResueltas';
import TicketVehicularDetalle from './pages/TicketVehicularDetalle';
import ProveedorNuevo from './pages/ProveedorNuevo';
<<<<<<< HEAD
=======
import GestionMonitoristas from './pages/GestionMonitoristas';
import AdministracionRoles from './pages/AdministracionRoles';
>>>>>>> a9fc0f8 (Modulo de gestión de monitoristas y Administración de roles)
import { useAuth } from './hooks/useAuth';
import { useState, useEffect } from 'react';
import './App.css';

// Componente de carga
const LoadingSpinner = () => (
  <div className="flex min-h-screen items-center justify-center bg-white">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#003594] mb-4"></div>
      <p className="text-gray-600">Cargando...</p>
    </div>
  </div>
);

// Componente protegido que verifica autenticación
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Ruta protegida por rol
const RoleRoute = ({ allow = [], children }) => {
  const { isLoading, isAuthenticated, role } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allow.length > 0 && role && !allow.includes(role)) {
    const fallback = role === 'admin' ? '/home' : '/home';
    return <Navigate to={fallback} replace />;
  }
  return children;
};

// Página de login
function LoginPage() {
  const { isAuthenticated, isLoading, error } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    console.error('Auth error:', error);
  }

  if (isAuthenticated) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white fixed inset-0 w-screen h-screen">
      <div className="w-full max-w-[420px] flex flex-col items-center animate-fadeIn">
        <div className="w-[150px] mb-9">
          <img
            src="/favicon.svg"
            alt="Logo"
            className="w-full h-auto object-contain filter drop-shadow"
          />
        </div>
        
        <h1 className="text-2xl font-semibold text-gray-900 text-center mb-2">
          Bienvenido
        </h1>
        
        <p className="text-base text-gray-600 text-center mb-9">
          Inicie sesión con su cuenta corporativa
        </p>

        <div className="w-full">
          <Login />
        </div>
      </div>
    </div>
  );
}

function App() {
  const [msalInstance, setMsalInstance] = useState(null);

  useEffect(() => {
    const initializeMsal = async () => {
      try {
        const instance = new PublicClientApplication(msalConfig);
        
        instance.addEventCallback((event) => {
          if (event.eventType === EventType.LOGIN_SUCCESS) {
            if (event.payload.account) {
              instance.setActiveAccount(event.payload.account);
            }
          }
        });

        await instance.initialize();
        setMsalInstance(instance);
      } catch (error) {
        console.error("Error initializing MSAL:", error);
        setMsalInstance(new PublicClientApplication(msalConfig));
      }
    };

    initializeMsal();
  }, []);

  if (!msalInstance) {
    return <LoadingSpinner />;
  }

  return (
    <MsalProvider instance={msalInstance}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/home" />} />
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <RoleRoute allow={['monitorista','admin']}>
                <SolicitudesPendientes />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/vehicular/:ticketId"
            element={
              <ProtectedRoute>
                <RoleRoute allow={['monitorista','admin']}>
                <TicketVehicularDetalle />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/resueltas"
            element={
              <ProtectedRoute>
                <RoleRoute allow={['monitorista','admin']}>
                <SolicitudesResueltas />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/proveedores/nuevo"
            element={
              <ProtectedRoute>
                <RoleRoute allow={['monitorista','admin']}>
                  <ProveedorNuevo />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
<<<<<<< HEAD
=======
          <Route
            path="/gestion-monitoristas"
            element={
              <ProtectedRoute>
                <RoleRoute allow={['admin']}>
                  <GestionMonitoristas />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/roles"
            element={
              <ProtectedRoute>
                <RoleRoute allow={['admin']}>
                  <AdministracionRoles />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
>>>>>>> a9fc0f8 (Modulo de gestión de monitoristas y Administración de roles)
          {/* Rutas para Administrador */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <RoleRoute allow={['admin']}>
                  <SolicitudesPendientes adminMode />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/vehicular/:ticketId"
            element={
              <ProtectedRoute>
                <RoleRoute allow={['admin']}>
                  <TicketVehicularDetalle />
                </RoleRoute>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </MsalProvider>
  );
}

// Añade la animación de fade-in
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;
document.head.appendChild(style);

export default App;
