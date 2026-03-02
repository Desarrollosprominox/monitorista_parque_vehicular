import { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useDataverseService } from '../services/dataverseService';
import { useAuth } from '../hooks/useAuth';
import { Copy, ArrowLeft, Edit, RefreshCw, Send, Car, Hash, Tag, CreditCard, Building2, Wrench, Flag, CheckCircle, Paperclip, Download, ArrowLeftRight, X, ExternalLink, Calendar, Clock, Trash2, FileText } from 'lucide-react';
import { calculateRemainingCreditDays } from '../utils/dateUtils';
import { createBlobClient } from '../services/blobClient';
import { useBlobFiles } from '../hooks/useBlobFiles';

function TicketVehicularDetalle() {
  const { isAuthenticated, login, role } = useAuth();
  const { ticketId } = useParams();
  const location = useLocation(); 
  const navigate = useNavigate();
  const { fetchVehicularTicketByCode, updateVehicularTicketStatus, fetchRoleEmailByCargo, updateVehicularTicketFields } = useDataverseService();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ticket, setTicket] = useState(location.state?.ticket || null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusValue, setStatusValue] = useState('');
  const [approving, setApproving] = useState(false);
  const [adminActioning, setAdminActioning] = useState(false);
  const didSetReviewRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        // Siempre obtenemos el ticket enriquecido (con datos del vehículo vía $expand)
        const data = await fetchVehicularTicketByCode(ticketId);
        if (mounted) setTicket(data);
      } catch (e) {
        if (mounted) setError(e.message || 'Error al cargar ticket');
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
  }, [isAuthenticated, ticketId, fetchVehicularTicketByCode]);

  // Al entrar por primera vez al detalle, cambiar estado a "En Revisión" (una sola vez por montaje)
  useEffect(() => {
    const t = ticket;
    const ticketGuid = t?.amv_ticketvehicularid;
    if (!ticketGuid) return;
    const sessionKey = `__tv_en_revision_set__:${ticketGuid}`;
    if (didSetReviewRef.current || sessionStorage.getItem(sessionKey) === '1') return;
    const current = (t.amv_estado || '').toString().trim().toLowerCase();
    // Solo auto-cambiar si el estado actual está "pendiente" (o vacío/abierto).
    const isAlreadyReview = current === 'en revisión' || current === 'en revision';
    const canAutoSet = current === '' || current === 'pendiente' || current === 'abierto';
    if (isAlreadyReview) {
      didSetReviewRef.current = true;
      try { sessionStorage.setItem(sessionKey, '1'); } catch {}
      return;
    }
    if (!canAutoSet) {
      // No forzar "En Revisión" si ya está en otros estados (en proceso/por aprobar/aprobado/etc.)
      didSetReviewRef.current = true;
      try { sessionStorage.setItem(sessionKey, '1'); } catch {}
      return;
    }
    (async () => {
      try {
        await updateVehicularTicketStatus(ticketGuid, 'En Revisión');
        // Registrar timestamp de apertura en la primera transición a "En Revisión"
        try {
          await updateVehicularTicketFields(ticketGuid, { amv_tsabierto: new Date().toISOString() });
        } catch (e) {
          console.warn('[TicketVehicularDetalle] No se pudo registrar amv_tsabierto:', e?.message || e);
        }
        setTicket(prev => ({ ...(prev || {}), amv_estado: 'En Revisión' }));
        try { sessionStorage.setItem(sessionKey, '1'); } catch {}
      } catch (e) {
        console.warn('[TicketVehicularDetalle] No se pudo establecer estado a "En Revisión":', e?.message || e);
      } finally {
        didSetReviewRef.current = true;
      }
    })();
  }, [ticket?.amv_ticketvehicularid, updateVehicularTicketStatus]);

  const readOnly = Boolean(location.state?.readOnly);

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

  return (
    <div className="min-h-screen" style={{ fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' }}>
      <Sidebar onCollapse={setIsSidebarCollapsed} />
      <main
        className={`transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'ml-16' : 'ml-64'}`}
      >
        {loading ? (
          <SkeletonDetail />
        ) : error ? (
          <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-5xl mx-auto">
            <div className="rounded-2xl bg-white border border-gray-100 p-6 text-red-600">
              {error}
            </div>
          </div>
        ) : !ticket ? (
          <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-5xl mx-auto">
            <div className="rounded-2xl bg-white border border-gray-100 p-6 text-gray-600">
              No se encontró el ticket solicitado.
            </div>
          </div>
        ) : (
          <>
            <TicketHeader ticketId={ticketId} zona={ticket.amv_zona} onChangeStatus={() => { setStatusValue(ticket.amv_estado || 'En proceso'); setStatusModalOpen(true); }} />
            <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-5xl mx-auto space-y-6">
              <VehiculoDetails vehiculo={ticket.vehiculo} />
              <TicketDetails ticket={ticket} />
              {String(role || '').toLowerCase() === 'admin' && (
                <TimeMarksSection ticket={ticket} />
              )}
              <DiagnosticosSection
                ticketCode={ticket.amv_ticket}
                ticketGuid={ticket.amv_ticketvehicularid}
                onTicketStatusChange={(s) => setTicket(prev => ({ ...(prev || {}), amv_estado: s }))}
                readOnly={readOnly || (String(ticket?.amv_estado || '').toLowerCase() === 'resuelta')}
              />
              {(() => {
                const st = (ticket?.amv_estado || '').toString().trim().toLowerCase();
                const show = ['por aprobar', 'aprobado', 'registrado por contabilidad', 'resuelta'].some(v => v.toLowerCase() === st);
                return show ? <PaymentProofSection ticketGuid={ticket.amv_ticketvehicularid} /> : null;
              })()}
              <InteraccionesHistorial ticket={ticket} readOnly={readOnly || (String(ticket?.amv_estado || '').toLowerCase() === 'resuelta')} />
              {/* Acciones finales */}
              {String(role || '').toLowerCase() !== 'admin' && !(readOnly || (String(ticket?.amv_estado || '').toLowerCase() === 'resuelta')) && (
                <div className="pt-4 flex justify-end">
                  <button
                    onClick={async () => {
                      if (!ticket?.amv_ticketvehicularid) { alert('No se encontró el identificador del ticket.'); return; }
                      try {
                        setApproving(true);
                        // Obtener correo del rol "Jefe de Parque Vehicular" y actualizar amv_aprueba + estado
                        const approverEmail = await fetchRoleEmailByCargo('Jefe de Parque Vehicular');
                        if (!approverEmail) {
                          throw new Error('No se encontró el correo del "Jefe de Parque Vehicular" en amv_rols.');
                        }
                        await updateVehicularTicketFields(ticket.amv_ticketvehicularid, {
                          amv_aprueba: String(approverEmail),
                          amv_estado: 'Por aprobar',
                          amv_enviaraprobacion: true,
                          amv_tsmandadoaaprobacion: new Date().toISOString()
                        });
                        // Notificar a Power Automate con el GUID del ticket
                        try {
                          const flowUrl = 'https://defaultdcbc0cef7e0e48419a93633aa4c88b.bf.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/6edba9b8c5b44e4898fa87354cf9460f/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pggSYqOAYkH8EB_LeN9nfnQIPBCjFVXLuwqo8Ydu1eg';
                          const guid = String(ticket.amv_ticketvehicularid).replace(/[{}"]/g, '');
                          await fetch(flowUrl, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ ticketId: guid })
                          });
                        } catch (notifyErr) {
                          console.warn('[TicketVehicularDetalle] No se pudo notificar a Power Automate:', notifyErr?.message || notifyErr);
                        }
                        setTicket(prev => ({ ...(prev || {}), amv_estado: 'Por aprobar', amv_aprueba: String(approverEmail), amv_enviaraprobacion: true }));
                        // Redirigir a la vista principal tras mandar a aprobación
                        if (window.history && window.history.length > 1) {
                          navigate(-1);
                        } else {
                          navigate('/home');
                        }
                      } catch (e) {
                        alert('No se pudo mandar a aprobación. ' + (e?.message || ''));
                      } finally {
                        setApproving(false);
                      }
                    }}
                    disabled={approving || !ticket}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#003594] px-5 py-2.5 text-white text-sm font-medium disabled:opacity-60 hover:bg-[#002b7a] focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
                  >
                    {approving ? 'Enviando…' : 'Mandar a aprobación'}
                  </button>
                </div>
              )}
              {String(role || '').toLowerCase() === 'admin' && String((ticket?.amv_estado || '')).toLowerCase() === 'por aprobar' && !readOnly && (
                <div className="pt-4 flex items-center justify-end gap-3">
                  <button
                    onClick={async () => {
                      if (!ticket?.amv_ticketvehicularid) { alert('No se encontró el identificador del ticket.'); return; }
                      try {
                        setAdminActioning(true);
                        // Rechazar: regresamos a Pendiente (puedes ajustar a otro estado si lo prefieres)
                        await updateVehicularTicketStatus(ticket.amv_ticketvehicularid, 'Pendiente');
                        // Registrar timestamp de rechazo
                        try {
                          await updateVehicularTicketFields(ticket.amv_ticketvehicularid, { amv_tsrechazado: new Date().toISOString() });
                        } catch (e) {
                          console.warn('[TicketVehicularDetalle] No se pudo registrar amv_tsrechazado:', e?.message || e);
                        }
                        setTicket(prev => ({ ...(prev || {}), amv_estado: 'En proceso' }));
                        // Notificar a Power Automate tras rechazar
                        try {
                          const flowUrl = 'https://defaultdcbc0cef7e0e48419a93633aa4c88b.bf.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/7e2275b623144286af9c56bf9a53f5fb/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=k4FlvsyLy-YilA7vueNpY6MuZsR_MbUjIuNFA_DSYHQ';
                          const guid = String(ticket.amv_ticketvehicularid).replace(/[{}"]/g, '');
                          await fetch(flowUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ticketId: guid })
                          });
                        } catch (notifyErr) {
                          console.warn('[TicketVehicularDetalle] No se pudo notificar flujo de rechazo:', notifyErr?.message || notifyErr);
                        }
                        // Redirigir a listado
                        if (location.pathname.startsWith('/admin')) navigate('/admin');
                        else if (window.history && window.history.length > 1) navigate(-1);
                        else navigate('/home');
                      } catch (e) {
                        alert('No se pudo rechazar el ticket. ' + (e?.message || ''));
                      } finally {
                        setAdminActioning(false);
                      }
                    }}
                    disabled={adminActioning}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-gray-800 text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    {adminActioning ? 'Procesando…' : 'Rechazar'}
                  </button>
                  <button
                    onClick={async () => {
                      if (!ticket?.amv_ticketvehicularid) { alert('No se encontró el identificador del ticket.'); return; }
                      try {
                        setAdminActioning(true);
                        await updateVehicularTicketStatus(ticket.amv_ticketvehicularid, 'Aprobado');
                        // Registrar timestamp de aprobación
                        try {
                          await updateVehicularTicketFields(ticket.amv_ticketvehicularid, { amv_tsaprobado: new Date().toISOString() });
                        } catch (e) {
                          console.warn('[TicketVehicularDetalle] No se pudo registrar amv_tsaprobado:', e?.message || e);
                        }
                        setTicket(prev => ({ ...(prev || {}), amv_estado: 'Aprobado' }));
                        // Notificar a Power Automate tras aprobar
                        try {
                          const flowUrl = 'https://defaultdcbc0cef7e0e48419a93633aa4c88b.bf.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/1fedd96d2642471e8fecf22ad5baab4c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=kRNuxtEyZycGU99CvCWG6w9mR7zpZY3s7UcEm34plkA';
                          const guid = String(ticket.amv_ticketvehicularid).replace(/[{}"]/g, '');
                          await fetch(flowUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ticketId: guid })
                          });
                        } catch (notifyErr) {
                          console.warn('[TicketVehicularDetalle] No se pudo notificar flujo de aprobación:', notifyErr?.message || notifyErr);
                        }
                        if (location.pathname.startsWith('/admin')) navigate('/admin');
                        else if (window.history && window.history.length > 1) navigate(-1);
                        else navigate('/home');
                      } catch (e) {
                        alert('No se pudo aprobar el ticket. ' + (e?.message || ''));
                      } finally {
                        setAdminActioning(false);
                      }
                    }}
                    disabled={adminActioning}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#003594] px-5 py-2.5 text-white text-sm font-medium disabled:opacity-60 hover:bg-[#002b7a] focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
                  >
                    {adminActioning ? 'Procesando…' : 'Aprobar'}
                  </button>
                </div>
              )}
            </div>
            {statusModalOpen && (
              <StatusModal
                currentStatus={ticket.amv_estado}
                value={statusValue}
                onChange={setStatusValue}
                onClose={() => setStatusModalOpen(false)}
                onConfirm={async () => {
                  try {
                    setStatusSaving(true);
                    await updateVehicularTicketStatus(ticket.amv_ticketvehicularid, statusValue);
                    setTicket(prev => ({ ...(prev || {}), amv_estado: statusValue }));
                    setStatusModalOpen(false);
                    // Redirigir a la vista principal tras cambiar el estado
                    if (window.history && window.history.length > 1) {
                      navigate(-1);
                    } else {
                      navigate('/home');
                    }
                  } catch (e) {
                    alert('No se pudo actualizar el estado. ' + (e?.message || ''));
                  } finally {
                    setStatusSaving(false);
                  }
                }}
                saving={statusSaving}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

// Comprobante(s) de pago: listado/visualización cuando el estado lo permite
function PaymentProofSection({ ticketGuid }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const cleanId = (ticketGuid || '').toString().replace(/[{}"]/g, '');
  const apiBase = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BLOB_API) || 'https://api-parquevehicular.prominox.app';

  const fetchList = async () => {
    if (!cleanId) { setFiles([]); setLoading(false); return; }
    try {
      setLoading(true);
      setError('');
      // Intento 1: ruta con /blob
      let res = await fetch(`${apiBase}/blob/list-payment-proof?ticketId=${encodeURIComponent(cleanId)}`);
      // Fallback: algunos despliegues exponen la ruta sin el prefijo /blob
      if (res.status === 404) {
        res = await fetch(`${apiBase}/list-payment-proof?ticketId=${encodeURIComponent(cleanId)}`);
      }
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const arr = Array.isArray(data?.blobs) ? data.blobs : [];
      setFiles(arr);
    } catch (e) {
      setError(e?.message || 'No se pudo listar comprobantes de pago');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, [cleanId]);

  const openUrl = (url) => {
    try { if (url) window.open(url, '_blank', 'noopener,noreferrer'); } catch {}
  };

  const downloadUrl = (url, suggestedName = 'comprobante') => {
    try {
      if (!url) return;
      const a = document.createElement('a');
      a.href = url;
      a.download = suggestedName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {}
  };

  return (
    <section className="rounded-2xl border border-gray-100 bg-white shadow-md overflow-hidden">
      <div className="px-6 py-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[12px] uppercase tracking-wide text-gray-500 font-semibold">Finanzas</div>
            <h2 className="mt-1 text-xl font-semibold text-gray-900">Comprobante(s) de pago</h2>
          </div>
          <button
            onClick={fetchList}
            title="Actualizar lista"
            aria-label="Actualizar lista de comprobantes"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#003594]/30"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-5 border-t border-gray-100" />
        <div className="mt-5">
          {loading ? (
            <div className="text-sm text-gray-500">Cargando comprobantes…</div>
          ) : error ? (
            <div className="text-sm text-red-600">Error: {error}</div>
          ) : files.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-[#F8F9FB] px-5 py-8 text-sm text-gray-600">
              No se encontraron comprobantes de pago para este ticket.
            </div>
          ) : (
            <ul className="space-y-3">
              {files.map((f, idx) => {
                const fileName = f?.name || f?.blobName || `comprobante_${idx + 1}.pdf`;
                const reference = f?.name || f?.blobName || '';
                const openLink = f?.downloadUrl || f?.blobUrl;
                const dlLink = f?.downloadUrl || f?.blobUrl;
                const lastMod = f?.properties?.lastModified ? new Date(f.properties.lastModified).toLocaleString() : null;
                return (
                  <li
                    key={f?.name || f?.blobName || idx}
                    className="group flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-3 hover:bg-[#F9FAFB] hover:shadow-sm transition-colors"
                  >
                    <div className="min-w-0 flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg bg-[#003594]/10 text-[#003594]">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-sm font-semibold text-gray-900">{fileName}</div>
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                            Comprobante cargado
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-gray-500 truncate">{reference}</div>
                        {lastMod ? <div className="text-[11px] text-gray-400">Última modificación: {lastMod}</div> : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openUrl(openLink)}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#003594] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#002b7a] focus:outline-none focus:ring-2 focus:ring-[#003594]/30"
                        aria-label={`Abrir ${fileName}`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Abrir
                      </button>
                      <button
                        onClick={() => downloadUrl(dlLink, fileName)}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#003594]/20"
                        aria-label={`Descargar ${fileName}`}
                      >
                        <Download className="w-3.5 h-3.5" />
                        Descargar
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

// Detalles del vehículo (desde lookup amv_vehiculod)
function VehiculoDetails({ vehiculo }) {
  const v = vehiculo || {};
  const items = [
    { label: 'No de serie', value: v.amv_name || '—', icon: <Hash className="w-4 h-4 text-gray-500" /> },
    { label: 'Marca / Capacidad', value: v.amv_marcacapacidad || '—', icon: <Car className="w-4 h-4 text-gray-500" /> },
    { label: 'No. económico', value: v.amv_noeconomico || '—', icon: <Tag className="w-4 h-4 text-gray-500" /> },
    { label: 'Placas', value: v.amv_placas || '—', icon: <CreditCard className="w-4 h-4 text-gray-500" /> },
    { label: 'Sucursal', value: v.amv_sucursal || '—', icon: <Building2 className="w-4 h-4 text-gray-500" /> },
  ];
  return (
    <section className="rounded-2xl md:rounded-3xl border border-gray-100 bg-white p-4 md:p-6 shadow-sm md:shadow-[0_16px_40px_-8px_rgba(16,24,40,0.22)]">
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Detalles del vehículo</div>
      <div className="rounded-xl bg-[#F9FAFB] p-3 md:p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((it, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-gray-200 bg-white p-3 md:p-4 transition-colors hover:bg-gray-50"
            style={{ animation: 'fadeIn 200ms ease-out both', animationDelay: `${idx * 25}ms` }}
          >
            <div className="flex items-start gap-3">
              <div className="mt-[2px]">{it.icon}</div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-500 font-medium">{it.label}</div>
                <div className="mt-1 text-sm text-gray-900 font-medium break-words">{it.value}</div>
              </div>
            </div>
          </div>
        ))}
        </div>
      </div>
    </section>
  );
}

// Detalles del ticket (en cuadro similar a los del vehículo)
function TicketDetails({ ticket }) {
  const t = ticket || {};

  // Map visual para badges de prioridad
  const priorityBadge = (p) => {
    const v = (p || '').toString().toLowerCase();
    if (v === 'crítica' || v === 'critica') return 'bg-red-50 text-red-700 ring-red-200';
    if (v === 'alta') return 'bg-orange-50 text-orange-700 ring-orange-200';
    if (v === 'media') return 'bg-yellow-50 text-yellow-700 ring-yellow-200';
    if (v === 'baja') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    return 'bg-gray-50 text-gray-700 ring-gray-200';
  };
  // Map visual para badges de estado
  const statusBadge = (s) => {
    const v = (s || '').toString().toLowerCase();
    if (v.includes('pend')) return 'bg-blue-50 text-blue-700 ring-blue-200'; // pendiente
    if (v.includes('proceso') || v.includes('revisión') || v.includes('revision')) return 'bg-sky-50 text-sky-700 ring-sky-200'; // en proceso
    if (v.includes('final') || v.includes('resu') || v.includes('cerr')) return 'bg-emerald-50 text-emerald-700 ring-emerald-200'; // finalizado
    return 'bg-gray-50 text-gray-700 ring-gray-200';
  };

  const descripcion = (t.amv_descripciondelproblema || '').toString().trim();

  return (
    <section className="rounded-2xl md:rounded-3xl border border-gray-100 bg-white p-4 md:p-6 shadow-sm md:shadow-[0_16px_40px_-8px_rgba(16,24,40,0.22)]">
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Detalles del ticket</div>

      {/* Grid de sub-cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tipo de servicio */}
        <div
          className="rounded-xl border border-gray-200 bg-white p-3 md:p-4 transition-all duration-200 hover:bg-gray-50"
          style={{ animation: 'fadeIn 200ms ease-out both', animationDelay: '0ms' }}
        >
          <div className="flex items-start gap-3">
            <Wrench className="w-4 h-4 text-gray-500 mt-[2px]" />
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-500 font-medium">Tipo de servicio</div>
              <div className="mt-1 text-sm text-gray-900 font-semibold break-words">{t.amv_tipodeservicio || '—'}</div>
            </div>
          </div>
        </div>

        {/* Prioridad */}
        <div
          className="rounded-xl border border-gray-200 bg-white p-3 md:p-4 transition-all duration-200 hover:bg-gray-50"
          style={{ animation: 'fadeIn 200ms ease-out both', animationDelay: '40ms' }}
        >
          <div className="flex items-start gap-3">
            <Flag className="w-4 h-4 text-gray-500 mt-[2px]" />
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-500 font-medium">Prioridad</div>
              <div className="mt-1">
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${priorityBadge(t.amv_prioridad)}`}>
                  {t.amv_prioridad || '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sucursal */}
        <div
          className="rounded-xl border border-gray-200 bg-white p-3 md:p-4 transition-all duration-200 hover:bg-gray-50"
          style={{ animation: 'fadeIn 200ms ease-out both', animationDelay: '80ms' }}
        >
          <div className="flex items-start gap-3">
            <Building2 className="w-4 h-4 text-gray-500 mt-[2px]" />
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-500 font-medium">Sucursal</div>
              <div className="mt-1 text-sm text-gray-900 font-semibold break-words">{t.amv_sucursal || '—'}</div>
            </div>
          </div>
        </div>

        {/* Estado */}
        <div
          className="rounded-xl border border-gray-200 bg-white p-3 md:p-4 transition-all duration-200 hover:bg-gray-50"
          style={{ animation: 'fadeIn 200ms ease-out both', animationDelay: '120ms' }}
        >
          <div className="flex items-start gap-3">
            <CheckCircle className="w-4 h-4 text-gray-500 mt-[2px]" />
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-500 font-medium">Estado</div>
              <div className="mt-1">
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusBadge(t.amv_estado)}`}>
                  {t.amv_estado || '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Descripción del problema - ocupa ancho completo */}
        <div
          className="rounded-xl border border-gray-200 bg-gray-50 p-4 md:p-5 md:col-span-2"
          style={{ animation: 'fadeIn 200ms ease-out both', animationDelay: '160ms' }}
        >
          <div className="text-[12px] uppercase tracking-wide text-gray-600 font-semibold mb-2">Descripción del problema</div>
          <div className="min-h-[80px] md:min-h-[96px] flex items-center">
            <div className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed w-full break-words">
              {descripcion ? descripcion : <span className="text-gray-500">Sin descripción.</span>}
            </div>
          </div>
        </div>

        {/* Archivos adjuntos */}
        <div
          className="rounded-xl border border-gray-200 bg-white p-4 md:p-5 md:col-span-2 transition-all duration-200 hover:bg-gray-50"
          style={{ animation: 'fadeIn 200ms ease-out both', animationDelay: '200ms' }}
        >
          <VehicularAttachments ticketGuid={t.amv_ticketvehicularid} />
        </div>
      </div>
    </section>
  );
}

// Historial de interacciones (chat de comentarios)
function InteraccionesHistorial({ ticket, readOnly = false }) {
  const { user, isAuthenticated } = useAuth();
  const { fetchVehicularInteractions, createVehicularInteraction } = useDataverseService();
  const apiBase = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BLOB_API) || 'https://api-parquevehicular.prominox.app';
  const blob = useMemo(() => createBlobClient(apiBase), []);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState([]);
  const [fileErrors, setFileErrors] = useState([]);
  const [fileProgress, setFileProgress] = useState('');

  const ticketVehicularId = ticket?.amv_ticketvehicularid;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!ticketVehicularId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await fetchVehicularInteractions(ticketVehicularId);
        if (mounted) setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        console.warn('[InteraccionesHistorial] Error al cargar interacciones:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [ticketVehicularId, fetchVehicularInteractions]);

  const currentUserName = (user?.name || user?.username || '').toString();
  const getInitials = (name) => {
    const parts = (name || '').trim().split(/\s+/);
    const a = (parts[0] || '').charAt(0);
    const b = (parts[parts.length - 1] || '').charAt(0);
    return (a + b).toUpperCase() || 'U';
  };
  const formatDate = (iso) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso || '';
    }
  };

  const onSend = async (e) => {
    e?.preventDefault?.();
    const text = comment.trim();
    if ((!text && files.length === 0) || !isAuthenticated || !ticketVehicularId) return;
    try {
      setSending(true);
      // 1) Crear la interacción primero para obtener interactionId
      const created = await createVehicularInteraction({
        ticketVehicularId,
        comentario: text || '(archivo adjunto)'
      });
      setComment('');
      const newItem = {
        id: created.id || `tmp-${Date.now()}`,
        comentario: created.comentario || text || '(archivo adjunto)',
        createdOn: created.createdOn || new Date().toISOString(),
        createdBy: currentUserName || 'Yo',
        attachments: []
      };

      // 2) Si hay archivos, subirlos con el endpoint especial
      if (files.length > 0 && newItem.id) {
        const results = [];
        const errs = [];
        const cleanTicketId = (ticketVehicularId || '').toString().replace(/[{}]/g, '');
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          setFileProgress(`Subiendo ${f.name} (${i + 1}/${files.length})`);
          try {
            // Intento 1: ruta con /blob (consistente con otros endpoints)
            let res = await fetch(`${apiBase}/blob/sas-upload-interaction`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileName: f.name,
                contentType: f.type || 'application/octet-stream',
                ticketId: cleanTicketId,
                interactionId: newItem.id
              })
            });
            // Fallback: algunos despliegues exponen /sas-upload-interaction en la raíz
            if (res.status === 404) {
              res = await fetch(`${apiBase}/sas-upload-interaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fileName: f.name,
                  contentType: f.type || 'application/octet-stream',
                  ticketId: cleanTicketId,
                  interactionId: newItem.id
                })
              });
            }
            if (!res.ok) {
              const t = await res.text();
              throw new Error(t || `SAS interaction ${res.status}`);
            }
            const { uploadUrl, blobName, blobUrl } = await res.json();
            const putRes = await fetch(uploadUrl, {
              method: 'PUT',
              headers: {
                'x-ms-blob-type': 'BlockBlob',
                'Content-Type': f.type || 'application/octet-stream'
              },
              body: await f.arrayBuffer()
            });
            if (!putRes.ok) {
              const txt = await putRes.text();
              throw new Error(txt || `PUT ${putRes.status}`);
            }
            results.push({ fileName: f.name, blobName, blobUrl });
          } catch (err) {
            errs.push(`${f.name}: ${err?.message || 'Error'}`);
          }
        }
        setFileProgress('');
        setFileErrors(errs);
        newItem.attachments = results;
      }

      // 3) Agregar optimistamente al listado
      setItems(prev => [...prev, newItem]);
      setFiles([]);

      // 4) Desencadenar flujo de Power Automate al crear una nueva interacción
      try {
        const flowUrl = 'https://defaultdcbc0cef7e0e48419a93633aa4c88b.bf.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/d1881f9b5fcb4645866c14cefab2f089/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=hfLNiGoXPALVyyD63V3crwnsGbB0ASrdjrlR_3azjEM';
        const cleanTicket = (ticketVehicularId || '').toString().replace(/[{}"]/g, '');
        await fetch(flowUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticketId: cleanTicket })
        });
      } catch (notifyErr) {
        console.warn('[InteraccionesHistorial] No se pudo notificar flujo de nueva interacción:', notifyErr?.message || notifyErr);
      }
    } catch (e) {
      console.error('[InteraccionesHistorial] No se pudo enviar interacción:', e);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-0 overflow-visible shadow-[0_12px_32px_-8px_rgba(16,24,40,0.18)] md:shadow-[0_16px_40px_-8px_rgba(16,24,40,0.22)]">
      <div className="px-5 pt-5 pb-3">
        <div className="text-sm font-semibold text-gray-900">Historial de interacciones</div>
      </div>

      {/* keyframes locales para animación ligera */}
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Historial con scroll interno */}
      <div className="px-5 pb-3">
        {loading ? (
          <div className="text-sm text-gray-500">Cargando interacciones…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-gray-500">Sin interacciones todavía.</div>
        ) : (
          <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
            {items.map((it) => {
              const isOwn = currentUserName && it.createdBy && it.createdBy.toLowerCase() === currentUserName.toLowerCase();
              const initials = getInitials(isOwn ? (currentUserName || '') : (it.createdBy || 'U'));
              return (
                <div
                  key={it.id}
                  className={`flex items-end ${isOwn ? 'justify-end' : 'justify-start'}`}
                  style={{ animation: 'fadeInUp 180ms ease-out both' }}
                >
                  {!isOwn && (
                    <div className="mr-2 flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center text-xs font-semibold">
                      {initials}
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-xl border p-3 shadow-sm ${isOwn ? 'border-[#D6E4FF] bg-[#EAF2FF]' : 'border-gray-200 bg-[#F4F6F8]'}`}
                  >
                    {isOwn ? (
                      <div className="flex flex-col items-end mb-1">
                        <div className="text-xs font-medium text-gray-700">Tú</div>
                        <div className="text-[11px] text-gray-500">{formatDate(it.createdOn)}</div>
                      </div>
                    ) : (
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <div className="text-xs font-medium text-gray-700">{it.createdBy || 'Usuario'}</div>
                        <div className="text-[11px] text-gray-500">{formatDate(it.createdOn)}</div>
                      </div>
                    )}
                    <div className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">{it.comentario || ''}</div>
                    {Array.isArray(it.attachments) && it.attachments.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {it.attachments.map((a, idx) => (
                          <li key={`${a.blobName || a.name || idx}`} className="flex items-center justify-between rounded-md border border-gray-200 bg-white/60 px-2 py-1">
                            <div className="min-w-0 truncate text-xs text-gray-800">{a.fileName || a.name || 'archivo'}</div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => blob.openFile(a.blobName || a.name)}
                                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-100"
                              >
                                <ExternalLink className="w-3.5 h-3.5" /> Abrir
                              </button>
                              <button
                                type="button"
                                onClick={() => blob.downloadFile(a.blobName || a.name, a.fileName || 'archivo')}
                                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-100"
                              >
                                <Download className="w-3.5 h-3.5" /> Descargar
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {isOwn && (
                    <div className="ml-2 flex-shrink-0 w-8 h-8 rounded-full bg-[#003594] text-white flex items-center justify-center text-xs font-semibold">
                      {initials}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Barra de input (oculta en solo lectura) */}
      {!readOnly && (
      <div className="sticky bottom-0 z-20 bg-white border-t border-gray-100 shadow-[0_-4px_8px_-6px_rgba(0,0,0,0.15)] -mx-5 px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <form onSubmit={onSend}>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 sm:gap-3">
            <textarea
              className="flex-1 max-h-40 min-h-[44px] w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003594]/40 resize-y"
              rows={2}
              placeholder="Escribe un mensaje o adjunta archivos…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <label className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 cursor-pointer w-full sm:w-auto">
              <Paperclip className="w-4 h-4" />
              <span className="ml-2">Adjuntar</span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const picked = Array.from(e.target.files || []);
                  const max = 20 * 1024 * 1024;
                  const errs = [];
                  const ok = [];
                  for (const f of picked) {
                    if (f.size > max) errs.push(`${f.name}: excede 20MB`);
                    else ok.push(f);
                  }
                  setFileErrors(errs);
                  setFiles(prev => [...prev, ...ok]);
                  e.target.value = '';
                }}
              />
            </label>
            <button
              type="submit"
              disabled={sending || (!comment.trim() && files.length === 0)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#003594] px-4 py-2 text-white text-sm font-medium disabled:opacity-60 hover:bg-[#002b7a] focus:outline-none focus:ring-2 focus:ring-[#003594]/40 w-full sm:w-auto"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
          {/* Lista de archivos seleccionados y feedback */}
          {(files.length > 0 || fileErrors.length > 0 || fileProgress) && (
            <div className="mt-2 space-y-2">
              {files.length > 0 && (
                <ul className="space-y-1">
                  {files.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded-md border border-gray-200 px-2 py-1">
                      <div className="text-xs text-gray-800 truncate">{f.name} · {(f.size/1024/1024).toFixed(2)} MB</div>
                      <button
                        type="button"
                        onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-[11px] text-gray-600 hover:text-gray-900"
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {fileProgress ? <div className="text-xs text-gray-600">{fileProgress}</div> : null}
              {fileErrors.length > 0 && (
                <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                  {fileErrors.map((m, i) => <div key={i}>{m}</div>)}
                </div>
              )}
            </div>
          )}
        </form>
      </div>
      )}
    </section>
  );
}

// Archivos adjuntos del ticket vehicular
function VehicularAttachments({ ticketGuid }) {
  // Usamos ruta relativa con proxy de Vite: ver vite.config.js (/blob-api → backend)
  const apiBase = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BLOB_API) || 'https://api-parquevehicular.prominox.app';
  const blob = useMemo(() => createBlobClient(apiBase), []);
  const cleanId = (ticketGuid || '').toString().replace(/[{}]/g, '');
  const prefixes = useMemo(() => {
    if (!cleanId) return null;
    return [
      `tickets/${cleanId}`,
      `tickets/${cleanId}/`,
      `ticketvehicular/${cleanId}`,
      `vehicular/${cleanId}`,
      `${cleanId}`
    ];
  }, [cleanId]);
  const { files, loading, error } = useBlobFiles(blob, prefixes);

  const openFile = async (f) => {
    try {
      await blob.openFile(f.blobName || f.name);
    } catch (e) {
      console.error('[VehicularAttachments] No se pudo abrir:', e);
    }
  };
  const downloadFile = async (f) => {
    try {
      await blob.downloadFile(f.blobName || f.name, f.fileName || 'archivo');
    } catch (e) {
      console.error('[VehicularAttachments] No se pudo descargar:', e);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Paperclip className="w-4 h-4 text-gray-500" />
        <div className="text-[12px] uppercase tracking-wide text-gray-600 font-semibold">Archivos adjuntos</div>
      </div>
      {loading ? (
        <div className="text-sm text-gray-500">Cargando archivos…</div>
      ) : error ? (
        <div className="text-sm text-red-600">Error: {error}</div>
      ) : files.length === 0 ? (
        <div className="text-sm text-gray-500">Sin archivos adjuntos.</div>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => (
            <li key={f.blobName || f.name} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 hover:bg-gray-50">
              <div className="flex items-center gap-3 min-w-0">
                <Paperclip className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="truncate text-sm text-gray-900">{f.fileName || f.name}</div>
                  {f.lastModified ? <div className="text-[11px] text-gray-500">{new Date(f.lastModified).toLocaleString()}</div> : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openFile(f)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
                >
                  <ExternalLink className="w-4 h-4" /> Abrir
                </button>
                <button
                  onClick={() => downloadFile(f)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
                >
                  <Download className="w-4 h-4" /> Descargar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Header con acciones y badge de zona, botón copiar ID
function TicketHeader({ ticketId, zona, onChangeStatus }) {
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(ticketId || '');
    } catch {}
  };
  const goBack = () => {
    if (window && window.history) window.history.back();
  };
  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-3 sm:py-5">
      <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h1 className="text-lg sm:text-2xl font-semibold text-gray-900">Detalle de ticket</h1>
            {zona ? (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-[#003594] ring-1 ring-[#003594]/20">
                {zona}
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-xs sm:text-sm text-gray-500 break-all">{ticketId}</p>
            <button
              onClick={copyId}
              className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
              aria-label="Copiar ID de ticket"
              title="Copiar ID"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">

         
          <button
            onClick={goBack}
            className="hidden sm:inline-flex items-center gap-2 rounded-lg px-3 sm:px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>
        </div>
      </div>
    </header>
  );
}

// Modal para cambiar estado del ticket vehicular
function StatusModal({ currentStatus, value, onChange, onClose, onConfirm, saving }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose}></div>
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl ring-1 ring-gray-200 p-5 mx-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-base font-semibold text-gray-900">Cambiar estado</div>
          <button onClick={onClose} className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="text-sm text-gray-600 mb-4">
          Estado actual: <span className="font-medium text-gray-900">{currentStatus || '—'}</span>
        </div>
        <div className="space-y-2 mb-5">
          <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 cursor-pointer">
            <input
              type="radio"
              name="estado"
              value="En proceso"
              checked={value === 'En proceso'}
              onChange={(e) => onChange(e.target.value)}
              className="h-4 w-4 text-[#003594] border-gray-300"
            />
            <span className="text-sm text-gray-900">En proceso</span>
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 cursor-pointer">
            <input
              type="radio"
              name="estado"
              value="Resuelta"
              checked={value === 'Resuelta'}
              onChange={(e) => onChange(e.target.value)}
              className="h-4 w-4 text-[#003594] border-gray-300"
            />
            <span className="text-sm text-gray-900">Resuelta</span>
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="rounded-lg bg-[#003594] px-4 py-2 text-sm font-medium text-white hover:bg-[#002b7a] disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Diagnósticos (relación via lookup amv_ticketvehicular)
function DiagnosticosSection({ ticketCode, ticketGuid, onTicketStatusChange = () => {}, readOnly = false }) {
  const { fetchVehicularDiagnosticosByTicketCode, createVehicularDiagnostico, updateVehicularDiagnostico, deleteVehicularDiagnostico, searchProveedoresByNombre, updateVehicularTicketStatus, updateVehicularTicketFields } = useDataverseService();
  const navigate = useNavigate();
  const apiBase = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BLOB_API) || 'https://api-parquevehicular.prominox.app';
  const blob = useMemo(() => createBlobClient(apiBase), []);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ amv_diagnostico: '', amv_monto: '', amv_diasdecredito: '', amv_iniciocredito: '' });
  const [provQuery, setProvQuery] = useState('');
  const [provResults, setProvResults] = useState([]);
  const [provLoading, setProvLoading] = useState(false);
  const [selectedProveedor, setSelectedProveedor] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadDiag, setUploadDiag] = useState(null); // { id, label }
  const [filesRefreshKeyByDiag, setFilesRefreshKeyByDiag] = useState({});

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!ticketCode) { setLoading(false); return; }
      try {
        setLoading(true);
        const data = await fetchVehicularDiagnosticosByTicketCode(ticketCode);
        if (mounted) setRows(Array.isArray(data) ? data : []);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [ticketCode, fetchVehicularDiagnosticosByTicketCode]);

  // Buscar proveedores al escribir
  useEffect(() => {
    let active = true;
    const run = async () => {
      const q = provQuery.trim();
      if (q.length < 2) { setProvResults([]); return; }
      setProvLoading(true);
      try {
        const r = await searchProveedoresByNombre(q);
        if (active) setProvResults(r || []);
      } finally {
        if (active) setProvLoading(false);
      }
    };
    run();
    return () => { active = false; };
  }, [provQuery, searchProveedoresByNombre]);

  const handleUploaded = (diagnosticoId) => {
    setFilesRefreshKeyByDiag(prev => ({ ...prev, [diagnosticoId]: (prev[diagnosticoId] || 0) + 1 }));
  };

  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-[0_12px_32px_-8px_rgba(16,24,40,0.18)] md:shadow-[0_16px_40px_-8px_rgba(16,24,40,0.22)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3 md:mb-4">
        <div className="text-lg font-semibold text-gray-900">Diagnósticos</div>
        {!readOnly && (
        <button
          onClick={() => setModalOpen(true)}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[#003594] px-3 py-2 text-white text-sm font-medium hover:bg-[#002b7a] focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
        >
          + Agregar diagnóstico
        </button>
        )}
      </div>
      <div>
              {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 text-gray-500">Cargando diagnósticos…</div>
              ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-600">
            Aún no hay diagnósticos.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {rows.map((r, idx) => {
              const fmtCurrency = (v) => {
                if (v === null || v === undefined || v === '') return '—';
                try { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(Number(v)); } catch { return String(v); }
              };
              const fmtDate = (iso) => {
                if (!iso) return '—';
                try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
              };
              return (
                <div
                  key={r.id || idx}
                  className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{r.amv_diagnostico || '—'}</div>
                      <div className="mt-1">
                        {r.proveedorName ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-[#003594] ring-1 ring-[#003594]/20">
                            <Building2 className="w-3.5 h-3.5" />
                            {r.proveedorName}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                            <Building2 className="w-3.5 h-3.5" />
                            Sin proveedor
                          </span>
                        )}
                      </div>
        </div>
      </div>

                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-[#F9FAFB] px-3 py-2">
                      <div className="flex items-center gap-2 text-gray-700">
                        <CreditCard className="w-4 h-4 text-gray-500" />
                        <span className="text-xs">Monto</span>
                      </div>
                      <div className="text-sm font-semibold text-gray-900">{fmtCurrency(r.amv_monto)}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-3 py-2">
                        <div className="flex items-center gap-2 text-gray-700">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <span className="text-xs">Días crédito</span>
                        </div>
                        <div className="text-sm font-medium text-gray-900">{r.amv_diasdecredito ?? '—'}</div>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-3 py-2">
                        <div className="flex items-center gap-2 text-gray-700">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span className="text-xs">Inicio</span>
                        </div>
                        <div className="text-sm font-medium text-gray-900">{fmtDate(r.amv_iniciocredito)}</div>
                      </div>
                    </div>
                    {(() => {
                      const rem = calculateRemainingCreditDays(r.amv_iniciocredito, r.amv_diasdecredito);
                      if (rem == null) return null;
                      let classes = 'bg-gray-50 text-gray-700 ring-gray-200';
                      let text = '';
                      if (rem < 0) { classes = 'bg-red-50 text-red-700 ring-red-200'; text = `Vencido (${Math.abs(rem)} d)`; }
                      else if (rem === 0) { classes = 'bg-yellow-50 text-yellow-800 ring-yellow-200'; text = 'Vence hoy'; }
                      else if (rem <= 7) { classes = 'bg-yellow-50 text-yellow-800 ring-yellow-200'; text = `${rem} d restantes`; }
                      else { classes = 'bg-emerald-50 text-emerald-700 ring-emerald-200'; text = `${rem} d restantes`; }
                      return (
                        <div className="flex justify-end">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${classes}`}>
                            {text}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Archivos por diagnóstico */}
                  {r.id && ticketGuid ? (
                    <DiagnosticoFilesList
                      key={`files-${r.id}`}
                      blob={blob}
                      ticketGuid={ticketGuid}
                      diagnosticoId={r.id}
                      refreshKey={filesRefreshKeyByDiag[r.id] || 0}
                    />
                  ) : null}

                  <div className="mt-4 flex items-center justify-end gap-1.5">
                    <button
                      className="inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#003594]/30"
                      title="Ver detalle"
                      onClick={() => { setDetailItem(r); setDetailOpen(true); }}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    {!readOnly && (
                      <>
                    <button
                      className="inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#003594]/30"
                      title="Subir archivo"
                      onClick={() => {
                        setUploadDiag({ id: r.id, label: r.amv_diagnostico || r.id });
                        setUploadOpen(true);
                      }}
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <button
                      className="inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#003594]/30"
                      title="Editar"
                      onClick={() => {
                        setEditingId(r.id);
                        setForm({
                          amv_diagnostico: r.amv_diagnostico || '',
                          amv_monto: r.amv_monto ?? '',
                          amv_diasdecredito: r.amv_diasdecredito ?? '',
                          amv_iniciocredito: r.amv_iniciocredito ?? ''
                        });
                        if (r.proveedorId || r.proveedorName) {
                          setSelectedProveedor(r.proveedorId ? { id: r.proveedorId, name: r.proveedorName || '' } : null);
                        } else {
                          setSelectedProveedor(null);
                        }
                        setProvQuery('');
                        setProvResults([]);
                        setModalOpen(true);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      className="inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:opacity-60"
                      title="Eliminar"
                      disabled={deletingId === r.id}
                      onClick={async () => {
                        const ok = window.confirm('¿Eliminar este diagnóstico? Esta acción no se puede deshacer.');
                        if (!ok) return;
                        try {
                          setDeletingId(r.id);
                          await deleteVehicularDiagnostico(r.id);
                          setRows(prev => prev.filter(x => x.id !== r.id));
                        } catch (e) {
                          alert(e?.message || 'No se pudo eliminar el diagnóstico');
                        } finally {
                          setDeletingId(null);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de subida por diagnóstico */}
      {!readOnly && uploadOpen && uploadDiag && (
        <DiagnosticoUploadModal
          open={uploadOpen}
          onClose={() => { setUploadOpen(false); setUploadDiag(null); }}
          ticketGuid={ticketGuid}
          diagnosticoId={uploadDiag.id}
          diagnosticoLabel={uploadDiag.label}
          onUploaded={() => handleUploaded(uploadDiag.id)}
          blob={blob}
        />
      )}

      {/* Side drawer de detalle */}
      {detailOpen && detailItem && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDetailOpen(false)}></div>
          <style>{`
            @keyframes slideInRight { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
          `}</style>
          <aside
            className="absolute right-0 top-0 h-full w-full sm:w-[420px] md:w-[460px] lg:w-[480px] bg-white shadow-2xl ring-1 ring-gray-200 rounded-l-2xl flex flex-col"
            style={{ animation: 'slideInRight 200ms ease-out both' }}
          >
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-base font-semibold text-gray-900">
                    Diagnóstico {detailItem.id ? `#${detailItem.id}` : ''}
                  </div>
                  <div className="mt-2">
                    {detailItem.proveedorName ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-[#003594] ring-1 ring-[#003594]/20">
                        <Building2 className="w-3.5 h-3.5" />
                        {detailItem.proveedorName}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                        <Building2 className="w-3.5 h-3.5" />
                        Sin proveedor
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => setDetailOpen(false)} className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Resumen financiero */}
              <div className="rounded-xl border border-gray-100 bg-[#F9FAFB] p-4">
                <div className="text-xs uppercase tracking-wide text-gray-600 font-semibold mb-2">Resumen financiero</div>
                <div className="text-2xl font-bold text-[#003594]">
                  {(() => {
                    try {
                      return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(Number(detailItem.amv_monto ?? 0));
                    } catch { return String(detailItem.amv_monto ?? '—'); }
                  })()}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <div>
                      <div className="text-[11px] uppercase text-gray-500 font-medium">Días de crédito</div>
                      <div className="text-sm font-medium text-gray-900">{detailItem.amv_diasdecredito ?? '—'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <div>
                      <div className="text-[11px] uppercase text-gray-500 font-medium">Inicio</div>
                      <div className="text-sm font-medium text-gray-900">
                        {detailItem.amv_iniciocredito ? new Date(detailItem.amv_iniciocredito).toLocaleDateString() : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Información detallada */}
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="text-xs uppercase tracking-wide text-gray-600 font-semibold mb-3">Información detallada</div>
                <div className="space-y-3">
                  <div>
                    <div className="text-[11px] uppercase text-gray-500 font-medium">Diagnóstico</div>
                    <div className="text-sm text-gray-900">{detailItem.amv_diagnostico || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase text-gray-500 font-medium">Proveedor</div>
                    <div className="text-sm text-gray-900">{detailItem.proveedorName || '—'}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[11px] uppercase text-gray-500 font-medium">Monto</div>
                      <div className="text-sm text-gray-900">
                        {(() => {
                          try { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(detailItem.amv_monto ?? 0)); } catch { return String(detailItem.amv_monto ?? '—'); }
                        })()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase text-gray-500 font-medium">Días crédito</div>
                      <div className="text-sm text-gray-900">{detailItem.amv_diasdecredito ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase text-gray-500 font-medium">Inicio crédito</div>
                      <div className="text-sm text-gray-900">
                        {detailItem.amv_iniciocredito ? new Date(detailItem.amv_iniciocredito).toLocaleDateString() : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Estado del crédito */}
              {(() => {
                const dias = Number(detailItem.amv_diasdecredito ?? 0);
                const start = detailItem.amv_iniciocredito ? new Date(detailItem.amv_iniciocredito) : null;
                let status = 'sin_datos', label = 'Sin datos', classes = 'bg-gray-50 text-gray-700 ring-gray-200';
                if (start && !Number.isNaN(dias) && dias > 0) {
                  const due = new Date(start.getTime() + dias * 24 * 60 * 60 * 1000);
                  const diffDays = Math.ceil((due - new Date()) / (24 * 60 * 60 * 1000));
                  if (diffDays < 0) { status = 'vencido'; label = 'Vencido'; classes = 'bg-red-50 text-red-700 ring-red-200'; }
                  else if (diffDays <= 7) { status = 'por_vencer'; label = 'Próximo a vencer'; classes = 'bg-yellow-50 text-yellow-800 ring-yellow-200'; }
                  else { status = 'activo'; label = 'Activo'; classes = 'bg-emerald-50 text-emerald-700 ring-emerald-200'; }
                }
                return (
                  <div className="rounded-xl border border-gray-100 bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-600 font-semibold mb-2">Estado del crédito</div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${classes}`}>
                      {label}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Footer fijo (oculto en solo lectura) */}
            {!readOnly && (
            <div className="border-t border-gray-100 p-4 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  // Accionar edición con datos del detalle
                  const r = detailItem || {};
                  setEditingId(r.id);
                  setForm({
                    amv_diagnostico: r.amv_diagnostico || '',
                    amv_monto: r.amv_monto ?? '',
                    amv_diasdecredito: r.amv_diasdecredito ?? '',
                    amv_iniciocredito: r.amv_iniciocredito ?? ''
                  });
                  if (r.proveedorId || r.proveedorName) {
                    setSelectedProveedor(r.proveedorId ? { id: r.proveedorId, name: r.proveedorName || '' } : null);
                  } else {
                    setSelectedProveedor(null);
                  }
                  setProvQuery('');
                  setProvResults([]);
                  setDetailOpen(false);
                  setModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#003594]/30"
              >
                <Edit className="w-4 h-4" />
                Editar diagnóstico
              </button>
              <button
                onClick={async () => {
                  if (!detailItem?.id) return;
                  const ok = window.confirm('¿Eliminar este diagnóstico? Esta acción no se puede deshacer.');
                  if (!ok) return;
                  try {
                    setDeletingId(detailItem.id);
                    await deleteVehicularDiagnostico(detailItem.id);
                    setRows(prev => prev.filter(x => x.id !== detailItem.id));
                    setDetailOpen(false);
                  } catch (e) {
                    alert(e?.message || 'No se pudo eliminar el diagnóstico');
                  } finally {
                    setDeletingId(null);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-200"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar
              </button>
            </div>
            )}
          </aside>
        </div>
      )}

      {!readOnly && modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setModalOpen(false)}></div>
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-xl ring-1 ring-gray-200 p-6 mx-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xl font-semibold text-gray-900">{editingId ? 'Editar Diagnóstico' : 'Nuevo Diagnóstico'}</div>
              <button onClick={() => setModalOpen(false)} className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor (buscar por nombre)</label>
                {selectedProveedor ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-[#003594] ring-1 ring-[#003594]/20">
                      {selectedProveedor.name}
                    </span>
                    <button
                      onClick={() => { setSelectedProveedor(null); setProvQuery(''); }}
                      className="text-xs text-gray-600 hover:underline"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Escribe el nombre del proveedor"
                      value={provQuery}
                      onChange={(e) => setProvQuery(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
                    />
                    {provQuery.trim().length >= 2 && (
                      <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-56 overflow-auto transition-all duration-150">
                        {provLoading ? (
                          <div className="px-3 py-2 text-sm text-gray-500">Buscando…</div>
                        ) : provResults.length === 0 ? (
                          <div className="px-3 py-6 text-center text-sm text-gray-600">
                            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-gray-400 ring-1 ring-gray-200">
                              <Building2 className="h-5 w-5" />
                            </div>
                            <div className="font-medium text-gray-900">No encontramos este proveedor</div>
                            <div className="mt-1 text-gray-600">Puedes registrarlo en segundos</div>
                            <button
                              type="button"
                              onClick={() => { navigate('/proveedores/nuevo'); setProvResults([]); }}
                              className="mt-3 inline-flex items-center rounded-lg border border-[#003594]/30 bg-[#003594]/5 px-3 py-1.5 text-[#003594] hover:bg-[#003594]/10 focus:outline-none focus:ring-2 focus:ring-[#003594]/30"
                            >
                              Crear proveedor
                            </button>
                          </div>
                        ) : provResults.map(p => (
                          <button
                            key={p.id}
                            onClick={() => { setSelectedProveedor(p); setProvResults([]); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Diagnóstico</label>
                <textarea
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
                  rows={3}
                  placeholder="Describe el diagnóstico…"
                  value={form.amv_diagnostico}
                  onChange={(e) => setForm(f => ({ ...f, amv_diagnostico: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
                    value={form.amv_monto}
                    onChange={(e) => setForm(f => ({ ...f, amv_monto: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Días de crédito</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min="0"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
                    value={form.amv_diasdecredito}
                    onChange={(e) => setForm(f => ({ ...f, amv_diasdecredito: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inicio crédito</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
                    value={form.amv_iniciocredito}
                    onChange={(e) => setForm(f => ({ ...f, amv_iniciocredito: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!form.amv_diagnostico.trim()) { alert('El diagnóstico es requerido.'); return; }
                  try {
                    setSaving(true);
                    if (editingId) {
                      const updated = await updateVehicularDiagnostico({
                        id: editingId,
                        amv_diagnostico: form.amv_diagnostico.trim(),
                        amv_monto: form.amv_monto !== '' ? Number(form.amv_monto) : null,
                        amv_diasdecredito: form.amv_diasdecredito !== '' ? Number(form.amv_diasdecredito) : null,
                        amv_iniciocredito: form.amv_iniciocredito !== '' ? form.amv_iniciocredito : null,
                        proveedorId: selectedProveedor?.id ?? undefined
                      });
                    setRows(prev => prev.map(x => (x.id === editingId ? { ...x, ...updated } : x)));
                    // Cambiar estado del ticket a "En proceso" tras guardar edición del diagnóstico
                    try {
                      if (ticketGuid) {
                        await updateVehicularTicketStatus(ticketGuid, 'En proceso');
                        onTicketStatusChange('En proceso');
                        // Timestamp de primer diagnóstico (una sola vez)
                        try {
                          const firstDiagKey = `__tv_first_diag_ts__:${ticketGuid}`;
                          if (!sessionStorage.getItem(firstDiagKey)) {
                            await updateVehicularTicketFields(ticketGuid, { amv_tsprimerdiagnostico: new Date().toISOString() });
                            try { sessionStorage.setItem(firstDiagKey, '1'); } catch {}
                          }
                        } catch (e) {
                          console.warn('[DiagnosticosSection] No se pudo registrar amv_tsprimerdiagnostico:', e?.message || e);
                        }
                      }
                    } catch (e) {
                      console.warn('[DiagnosticosSection] No se pudo actualizar estado a En proceso:', e?.message || e);
                    }
                    } else {
                      if (!ticketGuid) { alert('No hay GUID del ticket vehicular.'); return; }
                    const created = await createVehicularDiagnostico({
                      ticketVehicularId: ticketGuid,
                      amv_diagnostico: form.amv_diagnostico.trim(),
                      amv_monto: form.amv_monto !== '' ? Number(form.amv_monto) : null,
                        amv_diasdecredito: form.amv_diasdecredito !== '' ? Number(form.amv_diasdecredito) : null,
                      amv_iniciocredito: form.amv_iniciocredito !== '' ? form.amv_iniciocredito : null,
                      proveedorId: selectedProveedor?.id || null
                    });
                    setRows(prev => [created, ...prev]);
                      // Cambiar estado del ticket a "En proceso" tras crear diagnóstico
                      try {
                        if (ticketGuid) {
                          await updateVehicularTicketStatus(ticketGuid, 'En proceso');
                          onTicketStatusChange('En proceso');
                          // Timestamp de primer diagnóstico (una sola vez)
                          try {
                            const firstDiagKey = `__tv_first_diag_ts__:${ticketGuid}`;
                            if (!sessionStorage.getItem(firstDiagKey)) {
                              await updateVehicularTicketFields(ticketGuid, { amv_tsprimerdiagnostico: new Date().toISOString() });
                              try { sessionStorage.setItem(firstDiagKey, '1'); } catch {}
                            }
                          } catch (e) {
                            console.warn('[DiagnosticosSection] No se pudo registrar amv_tsprimerdiagnostico:', e?.message || e);
                          }
                        }
                      } catch (e) {
                        console.warn('[DiagnosticosSection] No se pudo actualizar estado a En proceso:', e?.message || e);
                      }
                    }
                    setModalOpen(false);
                    setForm({ amv_diagnostico: '', amv_monto: '', amv_diasdecredito: '', amv_iniciocredito: '' });
                    setSelectedProveedor(null);
                    setProvQuery('');
                    setEditingId(null);
                  } catch (e) {
                    alert(e?.message || 'No se pudo guardar el diagnóstico');
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                className="rounded-lg bg-[#003594] px-4 py-2 text-sm font-medium text-white hover:bg-[#002b7a] disabled:opacity-60"
              >
                {saving ? 'Guardando…' : (editingId ? 'Actualizar' : 'Guardar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// Badges accesibles
function priorityBadgeClasses(p) {
  const v = (p || '').toString().toLowerCase();
  if (v === 'crítica') return 'bg-red-50 text-red-700 ring-red-200';
  if (v === 'alta') return 'bg-orange-50 text-orange-700 ring-orange-200';
  if (v === 'media') return 'bg-yellow-50 text-yellow-700 ring-yellow-200';
  if (v === 'baja') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  return 'bg-gray-50 text-gray-700 ring-gray-200';
}
function statusBadgeClasses(s) {
  const v = (s || '').toString().toLowerCase();
  if (v.includes('pend')) return 'bg-blue-50 text-blue-700 ring-blue-200';
  if (v.includes('revisión') || v.includes('proceso')) return 'bg-purple-50 text-purple-700 ring-purple-200';
  if (v.includes('resu')) return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  return 'bg-gray-50 text-gray-700 ring-gray-200';
}

// Cards de resumen
function TicketSummaryCards({ ticket }) {
  const copyVehiculo = async () => {
    try {
      await navigator.clipboard.writeText(ticket.amv_vehiculod || '');
    } catch {}
  };
  const items = [
    {
      label: 'Vehículo',
      value: ticket.amv_vehiculod || '—',
      extra: (
        <button
          onClick={copyVehiculo}
          className="ml-2 inline-flex items-center justify-center rounded-md p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#003594]/40"
          aria-label="Copiar vehículo"
        >
          <Copy className="w-4 h-4" />
        </button>
      )
    },
    {
      label: 'Prioridad',
      value: ticket.amv_prioridad || '—',
      render: (v) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${priorityBadgeClasses(v)}`}>
          {v || '—'}
        </span>
      )
    },
    {
      label: 'Estado',
      value: ticket.amv_estado || '—',
      render: (v) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusBadgeClasses(v)}`}>
          {v || '—'}
        </span>
      )
    },
    { label: 'Tipo de servicio', value: ticket.amv_tipodeservicio || '—' },
    { label: 'Sucursal', value: ticket.amv_sucursal || '—' },
    { label: 'Zona', value: ticket.amv_zona || '—' },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map((it, idx) => (
        <div key={idx} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
          <div className="text-xs uppercase tracking-wide text-gray-500 font-medium">{it.label}</div>
          <div className="mt-2 text-sm text-gray-900 flex items-center">
            {it.render ? it.render(it.value) : <span>{it.value}</span>}
            {it.extra}
          </div>
        </div>
      ))}
    </div>
  );
}

// Descripción en card
function TicketDescription({ description }) {
  const text = (description || '').toString().trim();
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
      <div className="text-sm font-semibold text-gray-900 mb-2">Descripción del problema</div>
      <div className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
        {text ? text : <span className="text-gray-500">Sin descripción.</span>}
      </div>
    </div>
  );
}

// Skeleton de detalle
function SkeletonDetail() {
  return (
    <>
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-5">
        <div className="h-6 w-56 bg-gray-200 rounded mb-2 animate-pulse"></div>
        <div className="h-4 w-40 bg-gray-200 rounded animate-pulse"></div>
      </header>
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-5xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
              <div className="h-3 w-24 bg-gray-200 rounded mb-3 animate-pulse"></div>
              <div className="h-5 w-40 bg-gray-200 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
          <div className="h-4 w-40 bg-gray-200 rounded mb-3 animate-pulse"></div>
          <div className="h-5 w-full bg-gray-200 rounded animate-pulse"></div>
          <div className="mt-2 h-5 w-2/3 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
    </>
  );
}

// ===== Archivos por diagnóstico (componentes auxiliares) =====
function DiagnosticoFilesList({ blob, ticketGuid, diagnosticoId, refreshKey = 0 }) {
  const cleanTicket = (ticketGuid || '').toString().replace(/[{}]/g, '');
  const prefixBase = `ticket/${cleanTicket}/diagnosticos/${diagnosticoId}`;
  const prefixes = useMemo(() => [prefixBase, `${prefixBase}/`], [prefixBase]);
  const { files, loading, error, refresh } = useBlobFiles(blob, prefixes);

  useEffect(() => { if (refreshKey >= 0) { refresh(); } }, [refreshKey]); // trigger refetch

  if (loading) {
    return <div className="mt-3 text-xs text-gray-500">Cargando archivos…</div>;
  }
  if (error) {
    return <div className="mt-3 text-xs text-red-600">Error al cargar archivos</div>;
  }
  return (
    <div className="mt-3">
      {files.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-500">Sin archivos</div>
      ) : (
        <ul className="space-y-1">
          {files.map((f) => (
            <li key={f.blobName || f.name} className="flex items-center justify-between rounded-lg border border-gray-100 bg-[#FAFAFA] px-3 py-1.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-gray-800">{f.fileName || f.name}</div>
                {f.lastModified ? <div className="text-[10px] text-gray-500">{new Date(f.lastModified).toLocaleString()}</div> : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => blob.openFile(f.blobName || f.name)}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-100"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Abrir
                </button>
                <button
                  onClick={() => blob.downloadFile(f.blobName || f.name, f.fileName || 'archivo')}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-100"
                >
                  <Download className="w-3.5 h-3.5" /> Descargar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DiagnosticoUploadModal({ open, onClose, ticketGuid, diagnosticoId, diagnosticoLabel, onUploaded, blob }) {
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState([]);
  const [progress, setProgress] = useState('');
  const [uploading, setUploading] = useState(false);

  if (!open) return null;

  const onPick = (e) => {
    const list = Array.from(e.target.files || []);
    const max = 20 * 1024 * 1024; // 20MB
    const errs = [];
    const ok = [];
    for (const f of list) {
      if (f.size > max) errs.push(`${f.name}: excede 20MB`);
      else ok.push(f);
    }
    setErrors(errs);
    setFiles(prev => [...prev, ...ok]);
    e.target.value = '';
  };

  const removeAt = (i) => {
    setFiles(prev => prev.filter((_, idx) => idx !== i));
  };

  const doUpload = async () => {
    if (!files.length) return;
    const cleanTicket = (ticketGuid || '').toString().replace(/[{}]/g, '');
    const folder = `ticket/${cleanTicket}/diagnosticos/${diagnosticoId}`;
    try {
      setUploading(true);
      const { okCount, failCount, errors: errs } = await blob.uploadFilesWithSasCustom(files, {
        folder,
        onProgress: (msg) => setProgress(msg || '')
      });
      setProgress('');
      setErrors(errs || []);
      if (okCount > 0) {
        onUploaded?.();
      }
      if (failCount === 0) {
        onClose?.();
      }
    } catch (e) {
      setErrors([e?.message || 'No se pudo subir']);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose}></div>
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl ring-1 ring-gray-200 rounded-l-2xl flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-start justify-between">
          <div>
            <div className="text-base font-semibold text-gray-900">Subir archivos al diagnóstico</div>
            <div className="text-sm text-gray-600 mt-0.5 truncate">{diagnosticoLabel || diagnosticoId}</div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Selecciona archivos (máx 20MB c/u)</label>
            <input type="file" multiple onChange={onPick} className="block w-full text-sm" />
          </div>
          {files.length > 0 && (
            <ul className="space-y-2">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-gray-900">{f.name}</div>
                    <div className="text-[11px] text-gray-500">{(f.size / 1024 / 1024).toFixed(2)} MB</div>
                  </div>
                  <button
                    onClick={() => removeAt(i)}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
          {errors.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
          {progress ? <div className="text-xs text-gray-600">{progress}</div> : null}
        </div>
        <div className="p-5 border-t border-gray-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={doUpload}
            disabled={uploading || files.length === 0}
            className="rounded-lg bg-[#003594] px-4 py-2 text-sm font-medium text-white hover:bg-[#002b7a] disabled:opacity-60"
          >
            {uploading ? 'Subiendo…' : 'Subir'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TicketVehicularDetalle;

// Marcas de tiempo (solo admin)
function TimeMarksSection({ ticket }) {
  const get = (keys = []) => {
    for (const k of keys) {
      const v = ticket?.[k];
      if (v) return v;
    }
    return null;
  };
  const fmt = (v) => {
    if (!v) return '—';
    try { return new Date(v).toLocaleString(); } catch { return String(v); }
  };
  const items = [
    { label: 'Creado', value: fmt(get(['createdon'])) },
    { label: 'Abierto por primera vez', value: fmt(get(['amv_tsabierto'])) },
    { label: 'Primer diagnóstico realizado', value: fmt(get(['amv_tsprimerdiagnostico'])) },
    { label: 'Enviado a aprobación', value: fmt(get(['amv_tsmandadoaaprobacion'])) },
    { label: 'Aprobado', value: fmt(get(['amv_tsaprobado'])) },
    { label: 'Rechazado', value: fmt(get(['amv_tsrechazado'])) },
    { label: 'Enviado a contabilidad', value: fmt(get(['amv_tsenviadoacontabilidad'])) },
    { label: 'Registrado por contabilidad', value: fmt(get(['amv_tsregistradoencontabilidad'])) },
    { label: 'Registrado por cuentas por pagar y resuelto', value: fmt(get(['amv_tsregistradoporcuentas'])) },
  ];
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 md:p-6 shadow-sm">
      <div className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">Marcas de tiempo</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((it, idx) => (
          <div key={idx} className="rounded-xl border border-gray-100 bg-[#F9FAFB] px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-gray-600 font-medium">{it.label}</div>
            <div className="mt-1 text-sm text-gray-900">{it.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
