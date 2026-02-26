import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useDataverseService } from '../services/dataverseService';
import { createBlobClient } from '../services/blobClient';
import { Building2, Upload, Paperclip, FileText, X, CheckCircle } from 'lucide-react';

function ProveedorNuevo() {
  const navigate = useNavigate();
  const { createProveedor, deleteProveedor } = useDataverseService();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [form, setForm] = useState({ amv_nombre: '', amv_ubicacion: '', amv_direccion: '', amv_correo: '', amv_telefono: '' });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // API de blob configurable o proxy
  const apiBase = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BLOB_API) || 'https://api-parquevehicular.prominox.app';
  const blob = createBlobClient(apiBase);

  // Estado de documentos
  const [docFiles, setDocFiles] = useState({
    constancia: null,
    comprobante: null,
    banco: null,
    opinion: null
  });

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!form.amv_nombre.trim()) {
      nextErrors.amv_nombre = 'El nombre del proveedor es obligatorio.';
    }
    // Validación: los 4 documentos son obligatorios
    const missing = [];
    if (!docFiles.constancia) missing.push('Constancia');
    if (!docFiles.comprobante) missing.push('Comprobante domicilio');
    if (!docFiles.banco) missing.push('Cuentas de banco');
    if (!docFiles.opinion) missing.push('Opinión positiva');
    if (Object.keys(nextErrors).length > 0 || missing.length > 0) {
      setErrors(nextErrors);
      if (missing.length > 0) {
        alert(`Faltan documentos obligatorios: ${missing.join(', ')}`);
      }
      return;
    }
    try {
      setSaving(true);
      const created = await createProveedor({
        amv_nombre: form.amv_nombre.trim(),
        amv_ubicacion: form.amv_ubicacion.trim() || undefined,
        amv_direccion: form.amv_direccion.trim() || undefined,
        amv_correo: form.amv_correo.trim() || undefined,
        amv_telefono: form.amv_telefono.trim() || undefined
      });
      // Subir documentos seleccionados en el mismo flujo
      const providerId = (created?.id || '').toString().replace(/[{}]/g, '');
      const tasks = [];
      const addTask = (type) => {
        const f = docFiles[type];
        if (f) {
          tasks.push(
            blob.uploadProviderDocument({
              providerId,
              documentType: type,
              file: f,
              onProgress: () => {}
            })
          );
        }
      };
      addTask('constancia');
      addTask('comprobante');
      addTask('banco');
      addTask('opinion');

      if (tasks.length > 0) {
        const results = await Promise.allSettled(tasks);
        const fails = results.filter(r => r.status === 'rejected');
        if (fails.length > 0) {
          // Rollback: eliminar el proveedor creado si falló alguna carga
          try {
            await deleteProveedor(providerId);
          } catch (rbErr) {
            console.warn('[ProveedorNuevo] Rollback fallido al eliminar proveedor:', rbErr?.message || rbErr);
          }
          alert(`No se pudo subir ${fails.length} documento(s). El proveedor no fue creado.`);
          setSaving(false);
          return;
        } else {
          alert('Proveedor y documentos subidos correctamente.');
        }
      } else {
        alert('Proveedor creado correctamente.');
      }

      // Notificar a Power Automate con el ID del proveedor creado
      try {
        const flowUrl = 'https://defaultdcbc0cef7e0e48419a93633aa4c88b.bf.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/47c54599ba57451ab447d969ba2d799b/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=4pHc8GVAmsPoCEvJh6uNLW5SWj3GrSYJwRZeR8Lcq7Q';
        await fetch(flowUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proveedorId: providerId })
        });
      } catch (notifyErr) {
        // No bloquear flujo por notificación fallida, solo registrar
        console.warn('[ProveedorNuevo] No se pudo notificar flujo de proveedor:', notifyErr?.message || notifyErr);
      }

      navigate('/home');
    } catch (err) {
      alert(err?.message || 'No se pudo crear el proveedor');
    } finally {
      setSaving(false);
    }
  };

  const pickDoc = (type) => (e) => {
    const f = e.target.files?.[0] || null;
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) {
      alert('Archivo supera 20MB');
      e.target.value = '';
      return;
    }
    setDocFiles(prev => ({ ...prev, [type]: f }));
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      <Sidebar onCollapse={setIsSidebarCollapsed} />
      <main className={`transition-all duration-300 ${isSidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
   
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto">
          <form onSubmit={onSubmit} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6 space-y-5">
            {/* Encabezado de página */}
            <div className="flex items-center gap-3 mb-2">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-[#003594] ring-1 ring-gray-200">
                <Building2 className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Agregar proveedor</h1>
                <p className="text-sm text-gray-600">Crea un nuevo proveedor y adjunta sus documentos.</p>
              </div>
            </div>

            {/* Sección 1: Datos del proveedor */}
            <div className="rounded-3xl border border-gray-100 bg-white shadow-[0_12px_28px_-10px_rgba(16,24,40,0.12)] p-5 md:p-6">
              <div className="mb-4">
                <div className="text-[11px] uppercase tracking-wide text-gray-500 font-medium">Datos del proveedor</div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label htmlFor="amv_nombre" className="block text-[11px] uppercase tracking-wide text-gray-500 font-medium mb-1">Nombre del proveedor</label>
                  <input
                    id="amv_nombre"
                    name="amv_nombre"
                    value={form.amv_nombre}
                    onChange={onChange}
                    placeholder="Ej. Bosch Service Reforma"
                    className={`w-full rounded-xl border px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#003594]/40 ${errors.amv_nombre ? 'border-red-300 bg-red-50/40' : 'border-gray-200'}`}
                    aria-invalid={!!errors.amv_nombre}
                    aria-describedby={errors.amv_nombre ? 'err-nombre' : undefined}
                  />
                  {errors.amv_nombre && <div id="err-nombre" className="mt-1 text-xs text-red-600">{errors.amv_nombre}</div>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="amv_ubicacion" className="block text-[11px] uppercase tracking-wide text-gray-500 font-medium mb-1">Ubicación</label>
                    <input
                      id="amv_ubicacion"
                      name="amv_ubicacion"
                      value={form.amv_ubicacion}
                      onChange={onChange}
                      placeholder="Ej. CDMX"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
                    />
                  </div>
                  <div>
                    <label htmlFor="amv_direccion" className="block text-[11px] uppercase tracking-wide text-gray-500 font-medium mb-1">Dirección</label>
                    <input
                      id="amv_direccion"
                      name="amv_direccion"
                      value={form.amv_direccion}
                      onChange={onChange}
                      placeholder="Calle, número, colonia..."
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="amv_correo" className="block text-[11px] uppercase tracking-wide text-gray-500 font-medium mb-1">Correo</label>
                    <input
                      id="amv_correo"
                      type="email"
                      name="amv_correo"
                      value={form.amv_correo}
                      onChange={onChange}
                      placeholder="proveedor@dominio.com"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
                    />
                    <div className="mt-1 text-[11px] text-gray-500">Formato: usuario@dominio.com</div>
                  </div>
                  <div>
                    <label htmlFor="amv_telefono" className="block text-[11px] uppercase tracking-wide text-gray-500 font-medium mb-1">Teléfono</label>
                    <input
                      id="amv_telefono"
                      type="tel"
                      name="amv_telefono"
                      value={form.amv_telefono}
                      onChange={onChange}
                      placeholder="55 1234 5678"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
                    />
                    <div className="mt-1 text-[11px] text-gray-500">10 dígitos.</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Documentos del proveedor (opcionales, se suben al guardar) */}
            <div className="pt-2">
              <div className="text-sm font-semibold text-gray-900 mb-3">Documentos del proveedor</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DocumentUploadCard
                  title="Constancia"
                  value={docFiles.constancia}
                  onPick={pickDoc('constancia')}
                  onRemove={() => setDocFiles(prev => ({ ...prev, constancia: null }))}
                  accept=".pdf,.jpg,.jpeg,.png"
                  required
                />
                <DocumentUploadCard
                  title="Comprobante domicilio"
                  value={docFiles.comprobante}
                  onPick={pickDoc('comprobante')}
                  onRemove={() => setDocFiles(prev => ({ ...prev, comprobante: null }))}
                  accept=".pdf,.jpg,.jpeg,.png"
                  required
                />
                <DocumentUploadCard
                  title="Cuentas de banco"
                  value={docFiles.banco}
                  onPick={pickDoc('banco')}
                  onRemove={() => setDocFiles(prev => ({ ...prev, banco: null }))}
                  accept=".pdf,.jpg,.jpeg,.png"
                  required
                />
                <DocumentUploadCard
                  title="Opinión positiva"
                  value={docFiles.opinion}
                  onPick={pickDoc('opinion')}
                  onRemove={() => setDocFiles(prev => ({ ...prev, opinion: null }))}
                  accept=".pdf,.jpg,.jpeg,.png"
                  required
                />
              </div>
              <div className="mt-2 text-[11px] text-gray-500">Máx 20MB por archivo. Permitidos: PDF, JPG, PNG.</div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#003594] px-4 py-2 text-sm font-medium text-white hover:bg-[#002b7a] disabled:opacity-60"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default ProveedorNuevo;

// Componente reutilizable: tarjeta de carga de documento con dropzone
function DocumentUploadCard({ title, value, onPick, onRemove, accept = '*', required = false }) {
  const [dragOver, setDragOver] = useState(false);

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      // Simular evento de input para reutilizar onPick
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.files = dt.files;
      const ev = { target: input };
      onPick(ev);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-[#003594] ring-1 ring-[#003594]/15">
            <Paperclip className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="text-sm font-semibold text-gray-900">{title}{required ? <span className="ml-1 text-red-600">*</span> : null}</div>
        </div>
      </div>
      {!value ? (
        <div
          className={`rounded-xl border-2 border-dashed px-4 py-6 text-center transition-all ${dragOver ? 'border-[#003594] bg-blue-50/30' : 'border-gray-300 bg-[#F9FAFB]'}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-5 h-5 text-gray-500" aria-hidden="true" />
            <div className="text-sm text-gray-700">Arrastra y suelta o selecciona un archivo</div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100">
              <span>Elegir archivo</span>
              <input type="file" className="hidden" onChange={onPick} accept={accept} aria-label={`Elegir archivo para ${title}`} />
            </label>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-[#FAFAFA] px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-gray-500" aria-hidden="true" />
            <div className="min-w-0">
              <div className="truncate text-sm text-gray-900">{value.name}</div>
              <div className="text-[11px] text-gray-500">{(value.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle className="w-3 h-3 mr-1" /> Listo
            </span>
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center justify-center rounded-md p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              aria-label={`Quitar archivo de ${title}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
