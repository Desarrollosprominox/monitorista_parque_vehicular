import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Sidebar from '../components/Sidebar';
import { useDataverseService } from '../services/dataverseService';

function SolicitudesPendientes({ adminMode = false }) {
  const { isAuthenticated, login, user, role } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState(() => {
    try {
      const cached = sessionStorage.getItem('__amv_solpend_cache__');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [zona, setZona] = useState(() => {
    try {
      return sessionStorage.getItem('__amv_solpend_zona__') || '';
    } catch {
      return '';
    }
  });

  const inFlightRef = useRef(false);
  // Filtros UI
  const [query, setQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sucursalFilter, setSucursalFilter] = useState('');
  const { fetchVehicularTickets, fetchMonitoristaZonaByEmail } = useDataverseService();
  // Tab de estado (fuente de verdad visual): 'Pendiente' | 'Por aprobar' | 'Aprobado'
  const [activeTabEstado, setActiveTabEstado] = useState(adminMode ? 'Por aprobar' : 'Pendiente');
  const didSetInitialTabRef = useRef(false);

  // Inyectar fuente Inter si no existe
  useEffect(() => {
    const existing = document.querySelector('link[data-font="inter"]');
    if (!existing) {
      const pre1 = document.createElement('link');
      pre1.rel = 'preconnect';
      pre1.href = 'https://fonts.googleapis.com';
      pre1.setAttribute('data-font', 'inter');
      const pre2 = document.createElement('link');
      pre2.rel = 'preconnect';
      pre2.href = 'https://fonts.gstatic.com';
      pre2.crossOrigin = 'anonymous';
      pre2.setAttribute('data-font', 'inter');
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
      link.setAttribute('data-font', 'inter');
      document.head.appendChild(pre1);
      document.head.appendChild(pre2);
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const throttleKey = '__amv_solpend_lastload__';
    const throttleMs = 15000; // 15s

    const load = async () => {
      try {
        if (inFlightRef.current) return;
        // Throttle por sesión para evitar múltiples llamadas por remount/HMR
        const last = parseInt(sessionStorage.getItem(throttleKey) || '0', 10);
        const now = Date.now();
        if (last && now - last < throttleMs) {
          return;
        }
        inFlightRef.current = true;

        setLoading(true);
        setError(null);

        const userEmail =
          (user && (user.username || (user.idTokenClaims && (user.idTokenClaims.preferred_username || user.idTokenClaims.email)))) || null;
        console.info('[SolicitudesPendientes] Usuario en sesión:', userEmail || '(desconocido)');

        const isAdminView = adminMode || String(role || '').toLowerCase() === 'admin';
        let effectiveZona = '';
        if (!isAdminView) {
          if (!userEmail) {
            throw new Error('No se pudo determinar el correo del usuario en sesión');
          }
          const userZona = await fetchMonitoristaZonaByEmail(userEmail).catch(() => '');
          if (!userZona) {
            console.warn(`[SolicitudesPendientes] Usuario ${userEmail} sin zona asignada. Cargando tickets sin filtro de zona.`);
          }
          effectiveZona = userZona || '';
          if (isMounted) setZona(effectiveZona);
          console.info('[SolicitudesPendientes] Zona del monitorista:', effectiveZona || '(sin zona)');
        } else {
          // Modo administrador: listar global (sin filtro por zona)
          effectiveZona = 'Global';
          if (isMounted) setZona('Global');
          console.info('[SolicitudesPendientes][Admin] Listado global sin filtro por zona');
        }

        const data = await fetchVehicularTickets({ zona: isAdminView ? undefined : (effectiveZona || undefined) });
        console.info('[SolicitudesPendientes] Tickets recibidos:', Array.isArray(data) ? data.length : 0);

        if (isMounted) {
          // Cachear para sobrevivir remounts/HMR y actualizar estado
          try {
            sessionStorage.setItem('__amv_solpend_cache__', JSON.stringify(data || []));
            sessionStorage.setItem('__amv_solpend_zona__', effectiveZona || '');
            sessionStorage.setItem(throttleKey, String(Date.now()));
          } catch { }
          setRows(data);
        }
      } catch (e) {
        if (isMounted) setError(e.message || 'Error al cargar datos');
      } finally {
        if (isMounted) setLoading(false);
        inFlightRef.current = false;
      }
    };

    if (isAuthenticated) {
      load();
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
      // Reset inFlight flag on unmount so subsequent mounts (e.g. Strict Mode) can retry if needed
      inFlightRef.current = false;
    };
  }, [isAuthenticated, role]);

  // Si el usuario es admin (por rol o prop), forzar pestaña inicial a "Por aprobar" una sola vez
  useEffect(() => {
    const isAdminView = adminMode || String(role || '').toLowerCase() === 'admin';
    if (isAdminView && !didSetInitialTabRef.current) {
      setActiveTabEstado('Por aprobar');
      didSetInitialTabRef.current = true;
    }
  }, [adminMode, role]);

  // Log cuando cambie el estado de rows para confirmar que React recibió los datos
  useEffect(() => {
    console.info('[SolicitudesPendientes] Estado rows actualizado. Total:', rows.length, 'Primer registro:', rows[0]);
  }, [rows]);

  // Derivar sucursales únicas para el filtro
  const sucursalOptions = useMemo(() => {
    const set = new Set();
    rows.forEach(r => {
      const v = (r.amv_sucursal || '').toString().trim();
      if (v) set.add(v);
    });
    return Array.from(set).sort();
  }, [rows]);

  // Filtro en frontend
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const normalize = (s) => (s || '').toString().trim().toLowerCase();
    const tabStatus = normalize(activeTabEstado); // única fuente de verdad visual

    return rows.filter(r => {
      const rowEstado = normalize(r.amv_estado);
      const matchesQuery = !q || [
        r.amv_ticket,
        r.amv_vehiculod,
        r.amv_sucursal,
        r.amv_descripciondelproblema
      ].some(v => (v || '').toString().toLowerCase().includes(q));
      const matchesPriority = !priorityFilter || normalize(r.amv_prioridad) === normalize(priorityFilter);
      // Filtro centralizado por estado: debe cumplir pestaña activa y, si existe, el dropdown
      const matchesTab = !tabStatus || rowEstado === tabStatus;
      const matchesSucursal = !sucursalFilter || (r.amv_sucursal || '').toString() === sucursalFilter;
      return matchesQuery && matchesPriority && matchesTab && matchesSucursal;
    });
  }, [rows, query, priorityFilter, sucursalFilter, activeTabEstado]);

  // Métricas
  const metrics = useMemo(() => {
    const total = filteredRows.length;
    const pendientes = filteredRows.filter(r => {
      const st = (r.amv_estado || '').toString().toLowerCase();
      return st.includes('pend') || st === '' || st === 'abierto' || st === 'en revisión';
    }).length;
    const criticos = filteredRows.filter(r => (r.amv_prioridad || '').toString().toLowerCase() === 'crítica').length;
    const enRiesgo = filteredRows.filter(r => (r.amv_prioridad || '').toString().toLowerCase() === 'alta').length;
    return { total, pendientes, criticos, enRiesgo };
  }, [filteredRows]);

  const clearFilters = () => {
    setQuery('');
    setPriorityFilter('');
    setSucursalFilter('');
  };

  const exportCSV = () => {
    const headers = [
      'amv_ticket',
      'amv_vehiculod',
      'amv_tipodeservicio',
      'amv_prioridad',
      'amv_descripciondelproblema',
      'amv_sucursal',
      'amv_estado',
      'amv_zona'
    ];
    const csv = [
      headers.join(','),
      ...filteredRows.map(r => headers.map(h => {
        const raw = (r[h] ?? '').toString().replace(/"/g, '""');
        return `"${raw}"`;
      }).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tickets_vehiculares_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Eliminado botón de "Nuevo ticket" según solicitud

  // Solo mostrar skeleton cuando no hay datos aún
  const isLoading = loading && rows.length === 0;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center" style={{ fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">No estás autenticado</h1>
          <button
            onClick={login}
            className="bg-[#003594] text-white px-4 py-2 rounded hover:bg-[#002b7a]"
          >
            Iniciar Sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' }}>
      <Sidebar onCollapse={setIsSidebarCollapsed} />
      <main
        className={`transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'ml-16' : 'ml-64'
          }`}
      >
        {/* Header / Topbar */}
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">{(adminMode || String(role || '').toLowerCase() === 'admin') ? 'Tickets vehiculares por aprobar' : 'Tickets vehiculares'}</h1>

                {(adminMode || String(role || '').toLowerCase() === 'admin' || zona) && (
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-[#003594] ring-1 ring-[#003594]/20">
                    {(adminMode || String(role || '').toLowerCase() === 'admin') ? 'Global' : `Zona ${zona}`}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">Gestión de solicitudes vehiculares asignadas por zona</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportCSV}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2 text-gray-700 text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
                aria-label="Exportar tickets a CSV"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="M7 10l5 5 5-5" />
                  <path d="M12 15V3" />
                </svg>
                Exportar
              </button>
            </div>
          </div>
        </header>

        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-6">
          {/* Tabs por amv_estado */}
          <TabsEstado
            value={activeTabEstado}
            onChange={setActiveTabEstado}
          />

          {/* Métricas / Cards */}
          {isLoading ? (
            <StatsSkeleton />
          ) : (
            <StatsCards metrics={metrics} />
          )}

          {/* Filtros */}
          <TicketsFilters
            query={query}
            setQuery={setQuery}
            priority={priorityFilter}
            setPriority={setPriorityFilter}
            sucursal={sucursalFilter}
            setSucursal={setSucursalFilter}
            sucursalOptions={sucursalOptions}
            clearFilters={clearFilters}
          />

          {/* Tabla / Estados */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100">
            {error && (
              <div className="p-6 text-red-600">Error: {error}</div>
            )}
            {!error && (
              <div className="p-0">
                {isLoading ? (
                  <TableSkeleton />
                ) : filteredRows.length === 0 ? (
                  <EmptyState onClear={clearFilters} />
                ) : (
                  <TicketsTable rows={filteredRows} />
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default SolicitudesPendientes;

// Subcomponentes UI
function TabsEstado({ value, onChange }) {
  const tabs = [
    { label: 'Pendientes', value: 'Pendiente' },
    { label: 'En revisión', value: 'En Revisión' },
    { label: 'En proceso', value: 'En proceso' },
    { label: 'Por aprobar', value: 'Por aprobar' },
    { label: 'Aprobados', value: 'Aprobado' },
  ];
  return (
    <div className="flex items-center gap-2">
      {tabs.map(t => {
        const active = value === t.value;
        return (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-sm ring-1 transition-colors
              ${active
                ? 'bg-[#003594] text-white ring-[#003594]'
                : 'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50'
              }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function StatsCards({ metrics }) {
  const items = [
    { label: 'Total', value: metrics.total },


  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((it) => (
        <div key={it.label} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <div className="text-sm text-gray-600">{it.label}</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{it.value}</div>
        </div>
      ))}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4 animate-pulse">
          <div className="h-3 w-24 bg-gray-200 rounded"></div>
          <div className="mt-3 h-7 w-16 bg-gray-200 rounded"></div>
        </div>
      ))}
    </div>
  );
}

function TicketsFilters({
  query, setQuery,
  priority, setPriority,
  sucursal, setSucursal,
  sucursalOptions,
  clearFilters
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4 sm:p-5">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="md:col-span-2">
          <label className="sr-only">Buscar</label>
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por ID, vehículo, sucursal…"
              className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-[#003594]/40 focus:border-[#003594] text-sm px-3 py-2"
            />
            <span className="pointer-events-none absolute right-3 top-2.5 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </span>
          </div>
        </div>
        <div>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-[#003594]/40 focus:border-[#003594] text-sm px-3 py-2"
          >
            <option value="">Prioridad</option>
            <option value="Crítica">Crítica</option>
            <option value="Alta">Alta</option>
            <option value="Media">Media</option>
            <option value="Baja">Baja</option>
          </select>
        </div>
        <div className="flex gap-2">
          <select
            value={sucursal}
            onChange={(e) => setSucursal(e.target.value)}
            className="flex-1 rounded-lg border-gray-300 focus:ring-2 focus:ring-[#003594]/40 focus:border-[#003594] text-sm px-3 py-2"
          >
            <option value="">Sucursal</option>
            {sucursalOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <button
            onClick={clearFilters}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
          >
            Limpiar
          </button>
        </div>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="p-4 sm:p-6">
      <div className="h-8 w-40 bg-gray-200 rounded mb-4 animate-pulse"></div>
      <div className="overflow-x-auto">
        <div className="min-w-[800px] space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onClear }) {
  return (
    <div className="p-8 text-center">
      <div className="mx-auto h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      </div>
      <h3 className="mt-4 text-sm font-medium text-gray-900">Sin resultados</h3>
      <p className="mt-1 text-sm text-gray-500">Ajusta o limpia los filtros para ver tickets.</p>
      <div className="mt-4">
        <button
          onClick={onClear}
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
        >
          Limpiar filtros
        </button>
      </div>
    </div>
  );
}

function TicketsTable({ rows }) {
  const priorityClasses = (p) => {
    const v = (p || '').toString().toLowerCase();
    if (v === 'crítica') return 'bg-red-50 text-red-700 ring-red-200';
    if (v === 'alta') return 'bg-orange-50 text-orange-700 ring-orange-200';
    if (v === 'media') return 'bg-yellow-50 text-yellow-700 ring-yellow-200';
    if (v === 'baja') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    return 'bg-gray-50 text-gray-700 ring-gray-200';
  };
  const estadoClasses = (e) => {
    const v = (e || '').toString().toLowerCase();
    if (v.includes('pend')) return 'bg-blue-50 text-blue-700 ring-blue-200';
    if (v.includes('por aprobar')) return 'bg-amber-50 text-amber-800 ring-amber-200';
    if (v.includes('revisión') || v.includes('revision') || v.includes('proceso')) return 'bg-sky-50 text-sky-700 ring-sky-200';
    if (v.includes('aprob')) return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    if (v.includes('resuelta')) return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    return 'bg-gray-50 text-gray-700 ring-gray-200';
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[900px] w-full text-sm">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-3">ID</th>
            <th className="px-4 py-3">Vehículo</th>
            <th className="px-4 py-3">Servicio</th>
            <th className="px-4 py-3">Prioridad</th>
            <th className="px-4 py-3">Descripción</th>
            <th className="px-4 py-3">Sucursal</th>
            <th className="px-4 py-3">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {rows.map((r, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">
                <Link
                  to={`/vehicular/${encodeURIComponent(r.amv_ticket)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  state={{ ticket: r }}
                  className="text-[#003594] hover:underline"
                  aria-label={`Abrir detalle del ticket ${r.amv_ticket} en nueva pestaña`}
                >
                  {r.amv_ticket}
                </Link>
              </td>
              <td className="px-4 py-3 text-gray-700">{r.amv_vehiculod}</td>
              <td className="px-4 py-3 text-gray-700">{r.amv_tipodeservicio}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${priorityClasses(r.amv_prioridad)}`}>
                  {r.amv_prioridad || '—'}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-700 max-w-[360px] truncate">{r.amv_descripciondelproblema}</td>
              <td className="px-4 py-3 text-gray-700">{r.amv_sucursal}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${estadoClasses(r.amv_estado)}`}>
                  {r.amv_estado || '—'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
