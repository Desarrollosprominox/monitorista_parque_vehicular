import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../hooks/useAuth';
import { useDataverseService } from '../services/dataverseService';
import {
  Shield,
  UserPlus,
  Search,
  RefreshCw,
  Users,
  User,
  Mail,
  Building2,
  BriefcaseBusiness,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react';

const ROLE_OPTIONS = [
  { value: 'Administrador', label: 'Administrador' },
  { value: 'Monitorista', label: 'Monitorista' },
  { value: 'Supervisor', label: 'Supervisor' },
  { value: 'Invitado', label: 'Invitado' },
];

const SUCURSALES = [
  'Guadalajara',
  'Morelia',
  'San Luis Potosi',
  'Culiacan',
  'Aguascalientes',
  'Cedis',
  'Leon',
  'Tlaquepaque',
  'Mazatlan',
  'Centro de servicios',
  'Chihuahua',
  'Torreon',
  'Monterrey',
  'Reynosa',
  'Tijuana',
  'Monterrey OTK',
  'Tlalnelpantla',
  'Queretaro',
  'Iztapalapa',
  'Puebla',
  'Veracruz',
  'Merida',
];

function getRoleBadgeClasses(rol) {
  const v = (rol || '').toString().toLowerCase();
  if (v.includes('admin')) return 'bg-[#EBF2FF] text-[#003594] ring-[#B7C8FF]';
  if (v.includes('monitor')) return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (v.includes('super')) return 'bg-amber-50 text-amber-800 ring-amber-200';
  if (v.includes('invit')) return 'bg-gray-100 text-gray-700 ring-gray-300';
  return 'bg-gray-100 text-gray-700 ring-gray-300';
}

function AdministracionRoles() {
  const { user } = useAuth();
  const { fetchRolesUsuarios, createRolUsuario, updateRolUsuario } = useDataverseService();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [query, setQuery] = useState('');
  const [sucursalFilter, setSucursalFilter] = useState('');
  const [rolFilter, setRolFilter] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [form, setForm] = useState({
    sucursal: '',
    nombre: '',
    correo: '',
    cargo: '',
    rol: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState({ show: false, message: '' });
  const [confirm, setConfirm] = useState({ show: false, message: '', onConfirm: null });

  const currentEmail = useMemo(() => {
    const acc = user || {};
    const claims = acc.idTokenClaims || {};
    const email =
      acc.username ||
      claims.preferred_username ||
      claims.email ||
      '';
    return (email || '').toString().toLowerCase();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchRolesUsuarios();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Error al cargar roles de usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const sucursales = SUCURSALES;

  const metrics = useMemo(() => {
    const total = rows.length;
    const admins = rows.filter((r) =>
      (r.rol || '').toString().toLowerCase().includes('admin')
    ).length;
    const monitoristas = rows.filter((r) =>
      (r.rol || '').toString().toLowerCase().includes('monitor')
    ).length;
    return { total, admins, monitoristas };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const matchQuery =
        !q ||
        [r.nombre, r.correo, r.cargo]
          .map((v) => (v || '').toString().toLowerCase())
          .some((v) => v.includes(q));
      const matchSucursal =
        !sucursalFilter || (r.sucursal || '').toString() === sucursalFilter;
      const matchRol =
        !rolFilter ||
        (r.rol || '').toString().toLowerCase().includes(rolFilter.toLowerCase());
      return matchQuery && matchSucursal && matchRol;
    });
  }, [rows, query, sucursalFilter, rolFilter]);

  const openCreateDrawer = () => {
    setEditingRow(null);
    setForm({
      sucursal: '',
      nombre: '',
      correo: '',
      cargo: '',
      rol: '',
    });
    setFormErrors({});
    setDrawerOpen(true);
  };

  const openEditDrawer = (row) => {
    setEditingRow(row);
    setForm({
      sucursal: row.sucursal || '',
      nombre: row.nombre || '',
      correo: row.correo || '',
      cargo: row.cargo || '',
      rol: row.rol || '',
    });
    setFormErrors({});
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingRow(null);
    setFormErrors({});
  };

  const validateForm = () => {
    const err = {};
    if (!form.nombre.trim()) err.nombre = 'El nombre es obligatorio.';
    if (!form.correo.trim()) err.correo = 'El correo es obligatorio.';
    if (form.correo.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo)) {
      err.correo = 'Introduce un correo válido.';
    }
    if (!form.rol.trim()) err.rol = 'Selecciona un rol.';
    setFormErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSaveCore = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      if (editingRow?.id) {
        await updateRolUsuario(editingRow.id, {
          amv_nombre: form.nombre.trim(),
          amv_correo: form.correo.trim(),
          amv_sucursal: form.sucursal.trim(),
          amv_cargo: form.cargo.trim(),
          amv_rol: form.rol.trim(),
        });
        setToast({ show: true, message: 'Rol actualizado correctamente.' });
      } else {
        await createRolUsuario({
          amv_nombre: form.nombre.trim(),
          amv_correo: form.correo.trim(),
          amv_sucursal: form.sucursal.trim(),
          amv_cargo: form.cargo.trim(),
          amv_rol: form.rol.trim(),
        });
        setToast({ show: true, message: 'Usuario creado correctamente.' });
      }
      await loadData();
      closeDrawer();
    } catch (e) {
      setFormErrors((prev) => ({
        ...prev,
        submit: e.message || 'Error al guardar.',
      }));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (!validateForm()) return;

    const editingIsAdmin = editingRow
      && (editingRow.rol || '').toString().toLowerCase().includes('admin');
    const newIsAdmin = (form.rol || '').toString().toLowerCase().includes('admin');
    const adminsCount = rows.filter((r) =>
      (r.rol || '').toString().toLowerCase().includes('admin')
    ).length;

    // Último administrador → confirmación fuerte
    if (editingRow?.id && editingIsAdmin && !newIsAdmin && adminsCount === 1) {
      setConfirm({
        show: true,
        message:
          'Esta acción puede afectar el acceso al sistema. Estás quitando el último Administrador. ¿Deseas continuar?',
        onConfirm: async () => {
          setConfirm({ show: false, message: '', onConfirm: null });
          await handleSaveCore();
        },
      });
      return;
    }

    handleSaveCore();
  };

  useEffect(() => {
    if (!toast.show) return;
    const t = setTimeout(
      () => setToast((prev) => ({ ...prev, show: false })),
      3000
    );
    return () => clearTimeout(t);
  }, [toast.show]);

  const isEditingSelf =
    editingRow &&
    currentEmail &&
    (editingRow.correo || '').toString().toLowerCase() === currentEmail;

  return (
    <div
      className="min-h-screen bg-[#F4F6FA]"
      style={{ fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' }}
    >
      <Sidebar onCollapse={setIsSidebarCollapsed} />
      <main
        className={`transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'ml-16' : 'ml-64'
        }`}
      >
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#003594] ring-1 ring-[#003594]/15">
                <Shield className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
                  Administración de roles y accesos
                </h1>
                <p className="text-sm text-gray-600">
                  Gestiona los permisos y cargos de los usuarios del sistema.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-gray-200">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500 font-medium">
                    Usuarios
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-sm font-semibold text-gray-900">
                    <Users className="w-4 h-4 text-gray-400" />
                    {metrics.total}
                  </div>
                </div>
                <div className="rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-gray-200">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500 font-medium">
                    Administradores
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">
                    {metrics.admins}
                  </div>
                </div>
                <div className="rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-gray-200">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500 font-medium">
                    Monitoristas
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">
                    {metrics.monitoristas}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={openCreateDrawer}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#003594] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#002b7a] focus:outline-none focus:ring-2 focus:ring-[#003594]/40 focus:ring-offset-2"
              >
                <UserPlus className="w-4 h-4" />
                Nuevo usuario
              </button>
            </div>
          </div>
        </header>

        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 space-y-4">
            {/* Barra de filtros */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nombre, correo o cargo…"
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-[#003594] focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
                />
              </div>
              <select
                value={sucursalFilter}
                onChange={(e) => setSucursalFilter(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-[#003594] focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
              >
                <option value="">Todas las sucursales</option>
                {sucursales.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={rolFilter}
                onChange={(e) => setRolFilter(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-[#003594] focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
              >
                <option value="">Todos los roles</option>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={loadData}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
              >
                <RefreshCw className="w-4 h-4" />
                Recargar
              </button>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Tabla */}
            <div className="overflow-x-auto">
              {loading ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  Cargando usuarios…
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  No se encontraron usuarios con los filtros actuales.
                </div>
              ) : (
                <table className="min-w-[880px] w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Sucursal</th>
                      <th className="px-4 py-3 text-left">Nombre</th>
                      <th className="px-4 py-3 text-left">Correo</th>
                      <th className="px-4 py-3 text-left">Cargo</th>
                      <th className="px-4 py-3 text-left">Rol</th>
                      <th className="px-4 py-3 text-left">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filteredRows.map((r) => (
                      <tr key={r.id || r.correo} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700">
                          {r.sucursal || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium">
                          {r.nombre || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {r.correo || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {r.cargo || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${getRoleBadgeClasses(
                              r.rol,
                            )}`}
                          >
                            {r.rol || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openEditDrawer(r)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:border-[#003594] hover:bg-[#003594]/5 hover:text-[#003594] focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
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

        {/* Drawer de edición / creación */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div
              className="flex-1 bg-black/30"
              onClick={closeDrawer}
              aria-hidden
            />
            <aside className="relative w-full max-w-md bg-white shadow-2xl ring-1 ring-gray-200 rounded-l-2xl flex flex-col">
              <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    {editingRow ? 'Editar usuario' : 'Nuevo usuario'}
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Actualiza sucursal, cargo y rol de acceso.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isEditingSelf && (
                <div className="m-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-[2px]" />
                  <p>
                    Estás modificando tu propio rol. Esto puede afectar tu acceso al sistema.
                  </p>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700 uppercase tracking-wide">
                    Sucursal
                  </label>
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <select
                      value={form.sucursal}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, sucursal: e.target.value }))
                      }
                      className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-9 text-sm text-gray-900 shadow-sm focus:border-[#003594] focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
                    >
                      <option value="">Selecciona una sucursal</option>
                      {SUCURSALES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700 uppercase tracking-wide">
                    Nombre
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={form.nombre}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, nombre: e.target.value }));
                        if (formErrors.nombre)
                          setFormErrors((prev) => ({ ...prev, nombre: undefined }));
                      }}
                      className={`w-full rounded-lg border bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-[#003594] focus:outline-none focus:ring-2 focus:ring-[#003594]/40 ${
                        formErrors.nombre ? 'border-red-300 bg-red-50/40' : 'border-gray-300'
                      }`}
                      placeholder="Nombre completo"
                    />
                  </div>
                  {formErrors.nombre && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.nombre}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700 uppercase tracking-wide">
                    Correo
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={form.correo}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, correo: e.target.value }));
                        if (formErrors.correo)
                          setFormErrors((prev) => ({ ...prev, correo: undefined }));
                      }}
                      className={`w-full rounded-lg border bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-[#003594] focus:outline-none focus:ring-2 focus:ring-[#003594]/40 ${
                        formErrors.correo ? 'border-red-300 bg-red-50/40' : 'border-gray-300'
                      } ${editingRow ? 'bg-gray-50 text-gray-700' : ''}`}
                      placeholder="usuario@dominio.com"
                      disabled={!!editingRow}
                    />
                  </div>
                  {formErrors.correo && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.correo}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-700 uppercase tracking-wide">
                    Cargo
                  </label>
                  <div className="relative">
                    <BriefcaseBusiness className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={form.cargo}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, cargo: e.target.value }))
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-[#003594] focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
                      placeholder="Ej. Jefe de parque vehicular"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-gray-700 uppercase tracking-wide">
                    Rol
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {ROLE_OPTIONS.map((opt) => {
                      const selected =
                        (form.rol || '').toString().toLowerCase().includes(
                          opt.value.toLowerCase(),
                        );
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              rol: opt.value,
                            }))
                          }
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                            selected
                              ? 'border-[#003594] bg-[#EBF2FF]'
                              : 'border-gray-200 bg-white hover:border-[#003594] hover:bg-[#F3F4FF]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${getRoleBadgeClasses(
                                opt.value,
                              )}`}
                            >
                              {opt.label}
                            </span>
                            <span className="text-xs text-gray-500">
                              {opt.value === 'Administrador' &&
                                'Acceso completo a la administración.'}
                              {opt.value === 'Monitorista' &&
                                'Gestión operativa de tickets y monitoreo.'}
                              {opt.value === 'Supervisor' &&
                                'Supervisión y aprobación de procesos.'}
                              {opt.value === 'Invitado' &&
                                'Acceso de solo consulta limitado.'}
                            </span>
                          </div>
                          {selected && (
                            <Check className="w-4 h-4 text-[#003594]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {formErrors.rol && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.rol}</p>
                  )}
                </div>

                {formErrors.submit && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {formErrors.submit}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 px-5 py-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeDrawer}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-60"
                >
                  <X className="w-4 h-4" />
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#003594] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#002b7a] focus:outline-none focus:ring-2 focus:ring-[#003594]/40 focus:ring-offset-2 disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Guardando…
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Guardar cambios
                    </>
                  )}
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* Modal de confirmación crítico */}
        {confirm.show && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <div
              className="absolute inset-0 bg-black/30"
              aria-hidden
              onClick={() =>
                setConfirm({ show: false, message: '', onConfirm: null })
              }
            />
            <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl ring-1 ring-gray-200">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    Confirmar cambio de rol
                  </h3>
                  <p className="mt-2 text-sm text-gray-600">{confirm.message}</p>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setConfirm({ show: false, message: '', onConfirm: null })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirm.onConfirm || (() => {})}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  Continuar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast de confirmación */}
        {toast.show && (
          <div className="fixed bottom-6 right-6 z-[55] flex items-center gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-lg ring-1 ring-gray-200">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check className="h-4 w-4" />
            </div>
            <p className="text-sm font-medium text-gray-900">{toast.message}</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default AdministracionRoles;

