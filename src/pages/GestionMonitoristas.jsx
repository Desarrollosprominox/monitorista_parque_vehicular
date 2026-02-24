import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../hooks/useAuth';
import { useDataverseService } from '../services/dataverseService';
import { User, Mail, MapPin, Check, X } from 'lucide-react';

const ZONAS_PREDEFINIDAS = ['Centro', 'Norte', 'Occidente'];

function GestionMonitoristas() {
  const { user } = useAuth();
  const { fetchMonitoristas, createMonitorista, updateMonitorista } = useDataverseService();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [zonaFilter, setZonaFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [form, setForm] = useState({ nombre: '', correo: '', zonasSelected: [] });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '' });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchMonitoristas();
        if (mounted) {
          setRows(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        if (mounted) {
          setError(e.message || 'Error al cargar monitoristas');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [fetchMonitoristas]);

  const zonas = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      const z = (r.zona || '').toString().trim();
      if (z) set.add(z);
    });
    return Array.from(set).sort();
  }, [rows]);

  const zonasDisponibles = ZONAS_PREDEFINIDAS;

  const openCreateModal = () => {
    setEditingRow(null);
    setForm({ nombre: '', correo: '', zonasSelected: [] });
    setFormErrors({});
    setModalOpen(true);
  };

  const openEditModal = (r) => {
    setEditingRow(r);
    setForm({
      nombre: r.nombre || '',
      correo: r.correo || '',
      zonasSelected: r.zona ? [r.zona] : [],
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingRow(null);
    setForm({ nombre: '', correo: '', zonasSelected: [] });
    setFormErrors({});
  };

  const toggleZona = (z) => {
    setForm((prev) => ({
      ...prev,
      zonasSelected: prev.zonasSelected.includes(z)
        ? prev.zonasSelected.filter((x) => x !== z)
        : [...prev.zonasSelected, z],
    }));
    if (formErrors.zonas) setFormErrors((e) => ({ ...e, zonas: undefined }));
  };

  const handleSave = async () => {
    const err = {};
    if (!form.nombre.trim()) err.nombre = 'El nombre completo es obligatorio.';
    if (!form.correo.trim()) err.correo = 'El correo es obligatorio.';
    if (form.correo.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo)) {
      err.correo = 'Introduce un correo válido.';
    }
    if (Object.keys(err).length) {
      setFormErrors(err);
      return;
    }
    setFormErrors({});
    setSaving(true);
    try {
      const zona = form.zonasSelected.length ? form.zonasSelected[0] : '';
      if (editingRow?.id) {
        await updateMonitorista(editingRow.id, {
          amv_nombre: form.nombre.trim(),
          amv_correo: form.correo.trim(),
          amv_zona: zona,
        });
        setToast({ show: true, message: 'Monitorista actualizado correctamente' });
      } else {
        await createMonitorista({
          amv_nombre: form.nombre.trim(),
          amv_correo: form.correo.trim(),
          amv_zona: zona,
        });
        setToast({ show: true, message: 'Monitorista creado correctamente' });
      }
      const data = await fetchMonitoristas();
      setRows(Array.isArray(data) ? data : []);
      closeModal();
    } catch (e) {
      setFormErrors({ submit: e.message || 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!toast.show) return;
    const t = setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 3000);
    return () => clearTimeout(t);
  }, [toast.show]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const matchQuery =
        !q ||
        [r.nombre, r.correo, r.zona]
          .map((v) => (v || '').toString().toLowerCase())
          .some((v) => v.includes(q));
      const matchZona = !zonaFilter || (r.zona || '').toString() === zonaFilter;
      return matchQuery && matchZona;
    });
  }, [rows, query, zonaFilter]);

  return (
    <div
      className="min-h-screen bg-[#F5F7FB]"
      style={{ fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' }}
    >
      <Sidebar onCollapse={setIsSidebarCollapsed} />
      <main
        className={`transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'ml-16' : 'ml-64'
        }`}
      >
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
                Gestión de monitoristas
              </h1>
             
            </div>
            {user?.name && (
              <div className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-[#003594] ring-1 ring-[#003594]/20">
                Sesión como: <span className="ml-1 font-semibold">{user.name}</span>
              </div>
            )}
          </div>
        </header>

        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-5 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3 w-full">
                <div className="flex-1">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por nombre, correo o zona…"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003594]/40 focus:border-[#003594]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={zonaFilter}
                    onChange={(e) => setZonaFilter(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003594]/40 focus:border-[#003594]"
                  >
                    <option value="">Todas las zonas</option>
                    {zonas.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setZonaFilter('');
                    }}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Limpiar
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500">
                  {filteredRows.length} monitorista(s)
                </span>
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#003594] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#002b7a] focus:outline-none focus:ring-2 focus:ring-[#003594]/40 focus:ring-offset-2"
                >
                  <User className="w-4 h-4" />
                  Nuevo monitorista
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setLoading(true);
                      setError(null);
                      const data = await fetchMonitoristas();
                      setRows(Array.isArray(data) ? data : []);
                    } catch (e) {
                      setError(e.message || 'Error al recargar monitoristas');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
                >
                  Recargar
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="overflow-x-auto">
              {loading ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  Cargando monitoristas…
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  No se encontraron monitoristas.
                </div>
              ) : (
                <table className="min-w-[640px] w-full text-sm table-fixed">
                  <colgroup>
                    <col className="w-[18%]" />
                    <col className="w-[30%]" />
                    <col className="w-[38%]" />
                    <col className="w-[14%]" />
                  </colgroup>
                  <thead className="bg-gray-50">
                    <tr className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Zona</th>
                      <th className="px-4 py-3 text-left">Nombre</th>
                      <th className="px-4 py-3 text-left">Correo</th>
                      <th className="px-4 py-3 text-left">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filteredRows.map((r) => (
                      <tr key={r.id || r.correo} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-left text-gray-700">
                          {r.zona || '—'}
                        </td>
                        <td className="px-4 py-3 text-left text-gray-900 font-medium">
                          {r.nombre || '—'}
                        </td>
                        <td className="px-4 py-3 text-left text-gray-700">
                          {r.correo || '—'}
                        </td>
                        <td className="px-4 py-3 text-left">
                          <button
                            type="button"
                            onClick={() => openEditModal(r)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-[#003594] hover:bg-[#003594]/5 hover:text-[#003594] focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Modal Editar / Crear Monitorista */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/30 transition-opacity"
              onClick={closeModal}
              aria-hidden
            />
            <div
              className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl ring-1 ring-gray-200"
              style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
            >
              <div className="mb-6">
                <h2 id="modal-title" className="text-xl font-semibold text-gray-900">
                  {editingRow ? 'Editar monitorista' : 'Nuevo monitorista'}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Asigna la información y zonas de operación del monitorista
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Nombre completo
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <User className="w-5 h-5" />
                    </div>
                    <input
                      type="text"
                      value={form.nombre}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, nombre: e.target.value }));
                        if (formErrors.nombre) setFormErrors((e) => ({ ...e, nombre: undefined }));
                      }}
                      placeholder="Ej. Juan Pérez García"
                      className={`w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#003594]/40 focus:ring-offset-0 ${
                        formErrors.nombre ? 'border-red-300 bg-red-50/50' : 'border-gray-300 bg-white hover:border-gray-400'
                      }`}
                      aria-invalid={!!formErrors.nombre}
                    />
                  </div>
                  {formErrors.nombre && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.nombre}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Correo
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <Mail className="w-5 h-5" />
                    </div>
                    <input
                      type="email"
                      value={form.correo}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, correo: e.target.value }));
                        if (formErrors.correo) setFormErrors((e) => ({ ...e, correo: undefined }));
                      }}
                      placeholder="correo@ejemplo.com"
                      className={`w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#003594]/40 focus:ring-offset-0 ${
                        formErrors.correo ? 'border-red-300 bg-red-50/50' : 'border-gray-300 bg-white hover:border-gray-400'
                      }`}
                      aria-invalid={!!formErrors.correo}
                    />
                  </div>
                  {formErrors.correo && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.correo}</p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Zona(s) asignadas
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {zonasDisponibles.map((z) => {
                      const selected = form.zonasSelected.includes(z);
                      return (
                        <button
                          key={z}
                          type="button"
                          onClick={() => toggleZona(z)}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[#003594]/40 focus:ring-offset-2 ${
                            selected
                              ? 'border-[#003594] bg-[#003594] text-white shadow-sm'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-[#003594] hover:bg-[#003594]/5 hover:text-[#003594]'
                          }`}
                        >
                          <MapPin className="w-4 h-4" />
                          {z}
                          {selected && <Check className="w-4 h-4" />}
                        </button>
                      );
                    })}
                  </div>
                  {formErrors.zonas && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.zonas}</p>
                  )}
                </div>

                {formErrors.submit && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {formErrors.submit}
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-60"
                >
                  <X className="w-4 h-4" />
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#003594] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#002b7a] focus:outline-none focus:ring-2 focus:ring-[#003594]/40 focus:ring-offset-2 disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Guardando…
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Guardar monitorista
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast de confirmación */}
        {toast.show && (
          <div
            className="fixed bottom-6 right-6 z-[60] flex items-center gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-lg ring-1 ring-gray-200"
            role="status"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-gray-900">{toast.message}</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default GestionMonitoristas;

