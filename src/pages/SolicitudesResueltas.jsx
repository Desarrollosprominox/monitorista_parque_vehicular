import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../hooks/useAuth';
import { useDataverseService } from '../services/dataverseService';

function SolicitudesResueltas() {
  const { isAuthenticated, login } = useAuth();
  const { fetchResolvedVehicularTickets } = useDataverseService();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' (más reciente) | 'asc' (más antiguo)

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchResolvedVehicularTickets();
        if (mounted) setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        if (mounted) setError(e.message || 'Error al cargar solicitudes resueltas');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    if (isAuthenticated) {
      load();
    } else {
      setLoading(false);
    }
    return () => { mounted = false; };
  }, [isAuthenticated, fetchResolvedVehicularTickets]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">No estás autenticado</h1>
          <button onClick={login} className="bg-[#003594] text-white px-4 py-2 rounded hover:bg-[#002b7a]">
            Iniciar Sesión
          </button>
        </div>
      </div>
    );
  }

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      [r.amv_ticket, r.amv_vehiculod, r.amv_tipodeservicio, r.amv_sucursal]
        .some(v => (v || '').toString().toLowerCase().includes(q))
    );
  }, [rows, query]);

  // Ordenar por fecha de creación (o invertir si no hay fecha y se pide ASC)
  const sortedRows = useMemo(() => {
    const arr = Array.isArray(filteredRows) ? [...filteredRows] : [];
    // Intentar con createdon/createdOn si está disponible
    const hasCreated = arr.length > 0 && (arr[0]?.createdon || arr[0]?.createdOn);
    if (hasCreated) {
      arr.sort((a, b) => {
        const da = new Date(a.createdon || a.createdOn || 0).getTime();
        const db = new Date(b.createdon || b.createdOn || 0).getTime();
        return sortOrder === 'desc' ? (db - da) : (da - db);
      });
    } else if (sortOrder === 'asc') {
      arr.reverse(); // backend ya entrega desc
    }
    return arr;
  }, [filteredRows, sortOrder]);

  return (
    <div className="min-h-screen" style={{ fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' }}>
      <Sidebar onCollapse={setIsSidebarCollapsed} />
      <main className={`transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Solicitudes resueltas</h1>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <div className="w-full sm:w-64">
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar por ID, asunto o categoría…"
                  className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-[#003594]/40 focus:border-[#003594] text-sm px-3 py-2"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Ordenar:</label>
                <select
                  value={sortOrder}
                  onChange={e => setSortOrder(e.target.value)}
                  className="rounded-lg border-gray-300 focus:ring-2 focus:ring-[#003594]/40 focus:border-[#003594] text-sm px-3 py-2"
                >
                  <option value="desc">Más reciente primero</option>
                  <option value="asc">Más antiguo primero</option>
                </select>
              </div>
            </div>
          </div>
        </header>

        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100">
            {error ? (
              <div className="p-6 text-red-600">{error}</div>
            ) : loading ? (
              <div className="p-6 text-sm text-gray-500">Cargando…</div>
            ) : filteredRows.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">No hay solicitudes resueltas.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3">ID</th>
                      <th className="px-4 py-3">Vehículo</th>
                      <th className="px-4 py-3">Servicio</th>
                      <th className="px-4 py-3">Prioridad</th>
                      <th className="px-4 py-3">Sucursal</th>
                      <th className="px-4 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {sortedRows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          <Link
                            to={`/vehicular/${encodeURIComponent(r.amv_ticket)}`}
                            state={{ ticket: r, readOnly: true }}
                            className="text-[#003594] hover:underline"
                            aria-label={`Ver detalle del ticket ${r.amv_ticket} en modo lectura`}
                          >
                            {r.amv_ticket}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{r.amv_vehiculod || '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{r.amv_tipodeservicio || '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{r.amv_prioridad || '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{r.amv_sucursal || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 bg-emerald-50 text-emerald-700 ring-emerald-200">
                            Resuelta
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default SolicitudesResueltas;

