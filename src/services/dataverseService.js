import { useAuth } from '../hooks/useAuth';
import { useCallback } from 'react';
import { DATAVERSE_API_ENDPOINT } from '../config/constants';

export function useDataverseService() {
  const { getAccessToken } = useAuth();

  const fetchVehicularTickets = useCallback(async (options = {}) => {
    const { zona } = options || {};
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No se pudo obtener el token de acceso');
      }

      const zonaFilter = zona ? `&$filter=amv_zona eq '${String(zona).replace(/'/g, "''")}'` : '';
      // Incluir amv_zona siempre y pedir valores formateados
      const baseQuery = `?$select=amv_ticket,_amv_vehiculod_value,amv_tipodeservicio,amv_prioridad,amv_descripciondelproblema,amv_sucursal,amv_estado,amv_zona&$orderby=createdon desc&$top=5000`;
      const url = `${DATAVERSE_API_ENDPOINT}/amv_ticketvehiculars${baseQuery}${zonaFilter}`;

      console.info('[fetchVehicularTickets] URL:', url);
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0',
          // Incluir valores formateados (por ejemplo, nombre del lookup)
          'Prefer': 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"'
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[fetchVehicularTickets] Error response:', JSON.stringify(errorData, null, 2));
        throw new Error(`Error al obtener tickets vehiculares: ${response.status} - ${errorData.error?.message || 'Error desconocido'}`);
      }

      let data = await response.json();
      let records = Array.isArray(data.value) ? data.value : [];
      console.info('[fetchVehicularTickets] Registros (server filter):', records.length);

      // Fallback: si se solicitó zona y el filtro del servidor no devuelve registros,
      // obtener sin filtro y filtrar por el valor formateado en el cliente.
      if (zona && records.length === 0) {
        const unfUrl = `${DATAVERSE_API_ENDPOINT}/amv_ticketvehiculars${baseQuery}`;
        console.info('[fetchVehicularTickets] Fallback sin filtro. URL:', unfUrl);
        const unfResponse = await fetch(unfUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Prefer': 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"'
          },
        });
        if (unfResponse.ok) {
          const unfData = await unfResponse.json();
          const allRecords = Array.isArray(unfData.value) ? unfData.value : [];
          const target = String(zona).trim().toLowerCase();
          records = allRecords.filter(item => {
            const raw = (item.amv_zona ?? '').toString().trim().toLowerCase();
            const formatted = (item['amv_zona@OData.Community.Display.V1.FormattedValue'] ?? '').toString().trim().toLowerCase();
            return raw === target || formatted === target;
          });
          console.info('[fetchVehicularTickets] Registros tras fallback (cliente):', records.length);
        }
      }

      return records.map(item => ({
        amv_ticket: item.amv_ticket ?? '',
        // Para lookups, usar el valor formateado (nombre) y fallback al GUID
        amv_vehiculod: item['_amv_vehiculod_value@OData.Community.Display.V1.FormattedValue'] ?? item._amv_vehiculod_value ?? '',
        amv_vehiculod_id: item._amv_vehiculod_value ?? '',
        amv_tipodeservicio: item.amv_tipodeservicio ?? '',
        amv_prioridad: item.amv_prioridad ?? '',
        amv_descripciondelproblema: item.amv_descripciondelproblema ?? '',
        amv_sucursal: item.amv_sucursal ?? '',
        amv_estado: item.amv_estado ?? '',
        amv_zona: item['amv_zona@OData.Community.Display.V1.FormattedValue'] ?? item.amv_zona ?? '',
      }));
    } catch (error) {
      console.error('[fetchVehicularTickets] Error:', error);
      throw error;
    }
  }, [getAccessToken]);

  // Actualizar diagnóstico existente
  const updateVehicularDiagnostico = useCallback(async ({ id, amv_diagnostico, amv_monto, amv_diasdecredito, amv_iniciocredito, proveedorId }) => {
    const diagId = (id || '').toString().replace(/[{}"]/g, '');
    if (!diagId) throw new Error('Falta id del diagnóstico');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No se pudo obtener el token de acceso');
      const payload = {
        ...(amv_diagnostico !== undefined ? { amv_diagnostico: amv_diagnostico || '' } : {}),
        ...(amv_monto !== undefined ? { amv_monto: amv_monto !== null && amv_monto !== '' ? Number(amv_monto) : null } : {}),
        ...(amv_diasdecredito !== undefined ? { amv_diasdecredito: amv_diasdecredito !== null && amv_diasdecredito !== '' ? Number(amv_diasdecredito) : null } : {}),
        ...(amv_iniciocredito !== undefined ? { amv_iniciocredito: amv_iniciocredito ? String(amv_iniciocredito) : null } : {}),
        ...(proveedorId !== undefined
          ? (proveedorId
              ? { 'amv_proveedor@odata.bind': `/amv_proveedors(${String(proveedorId).replace(/[{}"]/g, '')})` }
              : { 'amv_proveedor@odata.bind': null })
          : {})
      };
      const resp = await fetch(`${DATAVERSE_API_ENDPOINT}/amv_diagnosticos(${diagId})`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        let txt = '';
        try { const err = await resp.json(); txt = JSON.stringify(err); } catch { txt = await resp.text(); }
        throw new Error(txt || 'No se pudo actualizar el diagnóstico');
      }
      const data = await resp.json();
      return {
        id: data.amv_diagnosticoid || data.amv_diagnosticosid || diagId,
        amv_diagnostico: data.amv_diagnostico ?? amv_diagnostico ?? '',
        amv_monto: data.amv_monto ?? amv_monto ?? null,
        amv_diasdecredito: data.amv_diasdecredito ?? amv_diasdecredito ?? null,
        amv_iniciocredito: data.amv_iniciocredito ?? amv_iniciocredito ?? null,
        proveedorId: data._amv_proveedor_value ?? proveedorId ?? null,
        proveedorName: data?.amv_proveedor?.amv_name ?? null,
        createdon: data.createdon || null
      };
    } catch (e) {
      console.error('[updateVehicularDiagnostico] Error:', e);
      throw e;
    }
  }, [getAccessToken]);

  // Eliminar diagnóstico
  const deleteVehicularDiagnostico = useCallback(async (id) => {
    const diagId = (id || '').toString().replace(/[{}"]/g, '');
    if (!diagId) throw new Error('Falta id del diagnóstico');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No se pudo obtener el token de acceso');
      const resp = await fetch(`${DATAVERSE_API_ENDPOINT}/amv_diagnosticos(${diagId})`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        }
      });
      if (!resp.ok && resp.status !== 204) {
        let txt = '';
        try { const err = await resp.json(); txt = JSON.stringify(err); } catch { txt = await resp.text(); }
        throw new Error(txt || 'No se pudo eliminar el diagnóstico');
      }
      return true;
    } catch (e) {
      console.error('[deleteVehicularDiagnostico] Error:', e);
      throw e;
    }
  }, [getAccessToken]);

  // Tickets vehiculares con estado "Resuelta"
  const fetchResolvedVehicularTickets = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No se pudo obtener el token de acceso');
      }
      const query = `?$select=amv_ticket,_amv_vehiculod_value,amv_tipodeservicio,amv_prioridad,amv_descripciondelproblema,amv_sucursal,amv_estado,amv_zona&$filter=amv_estado eq 'Resuelta'&$orderby=createdon desc`;
      const url = `${DATAVERSE_API_ENDPOINT}/amv_ticketvehiculars${query}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0',
          'Prefer': 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"'
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error('[fetchResolvedVehicularTickets] Error response:', errorData);
        throw new Error(`Error al obtener tickets vehiculares resueltos: ${response.status}`);
      }
      const data = await response.json();
      const records = Array.isArray(data.value) ? data.value : [];
      return records.map(item => ({
        amv_ticket: item.amv_ticket ?? '',
        amv_vehiculod: item['_amv_vehiculod_value@OData.Community.Display.V1.FormattedValue'] ?? item._amv_vehiculod_value ?? '',
        amv_vehiculod_id: item._amv_vehiculod_value ?? '',
        amv_tipodeservicio: item.amv_tipodeservicio ?? '',
        amv_prioridad: item.amv_prioridad ?? '',
        amv_descripciondelproblema: item.amv_descripciondelproblema ?? '',
        amv_sucursal: item.amv_sucursal ?? '',
        amv_estado: item.amv_estado ?? '',
        amv_zona: item['amv_zona@OData.Community.Display.V1.FormattedValue'] ?? item.amv_zona ?? '',
      }));
    } catch (error) {
      console.error('[fetchResolvedVehicularTickets] Error:', error);
      throw error;
    }
  }, [getAccessToken]);

  // Obtener un ticket vehicular por su campo amv_ticket (string legible)
  const fetchVehicularTicketByCode = useCallback(async (ticketCode) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No se pudo obtener el token de acceso');
      }
      if (!ticketCode) {
        throw new Error('Código de ticket no proporcionado');
      }
      const safeCode = String(ticketCode).replace(/'/g, "''");
      // Traemos el ticket y el GUID del lookup. Luego pedimos el vehículo por separado usando ese GUID.
      const query = `?$select=amv_ticket,amv_ticketvehicularid,_amv_vehiculod_value,amv_tipodeservicio,amv_prioridad,amv_descripciondelproblema,amv_sucursal,amv_estado,amv_zona&$filter=amv_ticket eq '${safeCode}'&$top=1`;
      const url = `${DATAVERSE_API_ENDPOINT}/amv_ticketvehiculars${query}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0',
          'Prefer': 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"'
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Error al obtener ticket vehicular: ${response.status} - ${errorData.error?.message || 'Error desconocido'}`);
      }
      const data = await response.json();
      const item = Array.isArray(data.value) && data.value.length > 0 ? data.value[0] : null;
      if (!item) return null;
      let vehiculo = null;
      const vehiculoId = item._amv_vehiculod_value;
      if (vehiculoId) {
        try {
          const vehiculoUrl = `${DATAVERSE_API_ENDPOINT}/amv_vehiculos(${vehiculoId})?$select=amv_name,amv_marcacapacidad,amv_noeconomico,amv_placas,amv_sucursal`;
          const vehiculoResp = await fetch(vehiculoUrl, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'OData-MaxVersion': '4.0',
              'OData-Version': '4.0',
              'Prefer': 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"'
            },
          });
          if (vehiculoResp.ok) {
            const v = await vehiculoResp.json();
            vehiculo = {
              amv_name: v.amv_name ?? '',
              amv_marcacapacidad: v.amv_marcacapacidad ?? '',
              amv_noeconomico: v.amv_noeconomico ?? '',
              amv_placas: v.amv_placas ?? '',
              amv_sucursal: v.amv_sucursal ?? '',
            };
          } else {
            // No interrumpimos si falla el fetch del vehículo
            console.warn('[fetchVehicularTicketByCode] No se pudo obtener el vehículo:', vehiculoResp.status);
          }
        } catch (ve) {
          console.warn('[fetchVehicularTicketByCode] Error al obtener vehículo:', ve);
        }
      }
      return {
        amv_ticketvehicularid: item.amv_ticketvehicularid ?? '',
        amv_ticket: item.amv_ticket ?? '',
        amv_vehiculod: item['_amv_vehiculod_value@OData.Community.Display.V1.FormattedValue'] ?? item._amv_vehiculod_value ?? '',
        amv_vehiculod_id: item._amv_vehiculod_value ?? '',
        amv_tipodeservicio: item.amv_tipodeservicio ?? '',
        amv_prioridad: item.amv_prioridad ?? '',
        amv_descripciondelproblema: item.amv_descripciondelproblema ?? '',
        amv_sucursal: item.amv_sucursal ?? '',
        amv_estado: item.amv_estado ?? '',
        amv_zona: item['amv_zona@OData.Community.Display.V1.FormattedValue'] ?? item.amv_zona ?? '',
        vehiculo
      };
    } catch (error) {
      console.error('[fetchVehicularTicketByCode] Error:', error);
      throw error;
    }
  }, [getAccessToken]);

  // Interacciones para ticket vehicular
  const fetchVehicularInteractions = useCallback(async (ticketVehicularId) => {
    if (!ticketVehicularId) return [];
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No se pudo obtener el token de acceso');
      const response = await fetch(
        `${DATAVERSE_API_ENDPOINT}/amv_interaccions?$filter=_amv_ticketvehicular_value eq ${ticketVehicularId}&$select=amv_interaccionid,amv_comentario,createdon&$expand=createdby($select=fullname)&$orderby=createdon asc`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0'
          },
        }
      );
      if (!response.ok) {
        console.error('[fetchVehicularInteractions] Error en la respuesta:', response.status);
        return [];
      }
      const data = await response.json();
      return (data.value || []).map(it => ({
        id: it.amv_interaccionid,
        comentario: it.amv_comentario || '',
        createdOn: it.createdon,
        createdBy: it.createdby ? it.createdby.fullname : 'Desconocido'
      }));
    } catch (e) {
      console.error('[fetchVehicularInteractions] Error:', e);
      return [];
    }
  }, [getAccessToken]);

  const createVehicularInteraction = useCallback(async ({ ticketVehicularId, comentario }) => {
    const token = await getAccessToken();
    if (!token) throw new Error('No se pudo obtener el token de acceso');
    if (!ticketVehicularId) throw new Error('Falta ticketVehicularId');
    const candidates = [
      'amv_TicketVehicular',
      'amv_ticketvehicular',
      'amv_TicketVehicularId',
      'amv_ticketvehicularid',
      'amv_TicketsVehicular',
      'amv_Ticket' // último intento genérico
    ];
    let lastError = null;
    for (const nav of candidates) {
      try {
        const payload = {
          amv_comentario: comentario,
          [`${nav}@odata.bind`]: `/amv_ticketvehiculars(${ticketVehicularId})`
        };
        const response = await fetch(
          `${DATAVERSE_API_ENDPOINT}/amv_interaccions`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'OData-MaxVersion': '4.0',
              'OData-Version': '4.0',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(payload),
          }
        );
        if (!response.ok) {
          const text = await response.text();
          console.warn(`[createVehicularInteraction] Falló con nav '${nav}':`, text);
          lastError = new Error(text);
          continue;
        }
        const data = await response.json();
        return {
          id: data.amv_interaccionid,
          comentario: data.amv_comentario || comentario,
          createdOn: data.createdon,
        };
      } catch (e) {
        console.warn(`[createVehicularInteraction] Excepción con nav '${nav}':`, e?.message || e);
        lastError = e;
        continue;
      }
    }
    console.error('[createVehicularInteraction] Todos los intentos fallaron');
    throw lastError || new Error('No se pudo crear la interacción');
  }, [getAccessToken]);

  // Archivos adjuntos de ticket vehicular (amv_archivos)
  const fetchVehicularFiles = useCallback(async (ticketVehicularId) => {
    if (!ticketVehicularId) return [];
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No se pudo obtener el token de acceso');
      // Probar posibles nombres del entity set
      const sets = ['amv_archivoses', 'amv_archivoes', 'amv_archivos', 'amv_archivo'];
      let lastErr = null;
      for (const setName of sets) {
        try {
          const url = `${DATAVERSE_API_ENDPOINT}/${setName}?$filter=_amv_ticketvehicular_value eq ${ticketVehicularId}&$orderby=createdon desc`;
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'OData-MaxVersion': '4.0',
              'OData-Version': '4.0'
            },
          });
          if (!response.ok) {
            const txt = await response.text();
            console.warn(`[fetchVehicularFiles] Falló con set '${setName}':`, response.status, txt);
            lastErr = new Error(txt);
            continue;
          }
          const data = await response.json();
          return (data.value || []).map(r => {
            const id = r.amv_archivosid || r.amv_archivoid || r.amv_archivo || r.amv_archivo_id || r.id;
            return {
              id,
              name: r.amv_nombre_archivo || r.filename || 'archivo',
              createdOn: r.createdon
            };
          }).filter(f => !!f.id);
        } catch (e) {
          console.warn(`[fetchVehicularFiles] Excepción con set '${setName}':`, e?.message || e);
          lastErr = e;
          continue;
        }
      }
      console.error('[fetchVehicularFiles] Todos los intentos fallaron');
      return [];
    } catch (e) {
      console.error('[fetchVehicularFiles] Error:', e);
      return [];
    }
  }, [getAccessToken]);

  const downloadVehicularFile = useCallback(async (archivoId, fileName) => {
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No se pudo obtener el token de acceso');
      const sets = ['amv_archivoses', 'amv_archivoes', 'amv_archivos', 'amv_archivo'];
      let lastErr = null;
      for (const setName of sets) {
        try {
          const resp = await fetch(`${DATAVERSE_API_ENDPOINT}/${setName}(${archivoId})/amv_archivo/$value`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/octet-stream',
              'OData-MaxVersion': '4.0',
              'OData-Version': '4.0'
            }
          });
          if (!resp.ok) {
            const txt = await resp.text();
            console.warn(`[downloadVehicularFile] Falló con set '${setName}':`, resp.status, txt);
            lastErr = new Error(txt);
            continue;
          }
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName || 'archivo';
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          return true;
        } catch (e) {
          console.warn(`[downloadVehicularFile] Excepción con set '${setName}':`, e?.message || e);
          lastErr = e;
          continue;
        }
      }
      throw lastErr || new Error('No se pudo descargar el archivo');
    } catch (e) {
      console.error('[downloadVehicularFile] Error:', e);
      throw e;
    }
  }, [getAccessToken]);

  const fetchMonitoristaZonaByEmail = useCallback(async (email) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No se pudo obtener el token de acceso');
      }
      if (!email) {
        throw new Error('Correo del usuario no disponible');
      }
      const escapedEmail = String(email).replace(/'/g, "''");
      const url = `${DATAVERSE_API_ENDPOINT}/amv_monitoristas?$select=amv_zona,amv_correo&$filter=amv_correo eq '${escapedEmail}'&$top=1`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error('[fetchMonitoristaZonaByEmail] Error response:', JSON.stringify(errorData, null, 2));
        throw new Error(`Error al buscar monitorista: ${response.status} - ${errorData.error?.message || 'Error desconocido'}`);
      }
      const data = await response.json();
      const record = Array.isArray(data.value) && data.value.length > 0 ? data.value[0] : null;
      return record ? (record.amv_zona ?? '') : '';
    } catch (error) {
      console.error('[fetchMonitoristaZonaByEmail] Error:', error);
      throw error;
    }
  }, [getAccessToken]);

  // Listar todos los registros de amv_monitoristas (para administración)
  const fetchMonitoristas = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No se pudo obtener el token de acceso');
      }
      // Preferir amv_nombre (campo personalizado) y usar amv_name solo como respaldo
      const url = `${DATAVERSE_API_ENDPOINT}/amv_monitoristas?$select=amv_monitoristaid,amv_zona,amv_nombre,amv_name,amv_correo&$orderby=amv_nombre asc`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        },
      });
      if (!response.ok) {
        let txt = '';
        try {
          const err = await response.json();
          txt = JSON.stringify(err);
        } catch {
          txt = await response.text();
        }
        throw new Error(txt || `Error al obtener monitoristas: ${response.status}`);
      }
      const data = await response.json();
      const records = Array.isArray(data.value) ? data.value : [];
      return records.map((r) => ({
        id: r.amv_monitoristaid || r.amv_monitoristasid || r.id,
        nombre: r.amv_nombre || r.amv_name || '',
        zona: r.amv_zona || '',
        correo: r.amv_correo || '',
      }));
    } catch (error) {
      console.error('[fetchMonitoristas] Error:', error);
      throw error;
    }
  }, [getAccessToken]);

  // Crear monitorista (amv_monitoristas)
  const createMonitorista = useCallback(async ({ amv_nombre, amv_correo, amv_zona }) => {
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No se pudo obtener el token de acceso');
      const payload = {
        amv_nombre: (amv_nombre || '').toString().trim(),
        amv_correo: (amv_correo || '').toString().trim(),
        amv_zona: (amv_zona || '').toString().trim() || null,
      };
      const resp = await fetch(`${DATAVERSE_API_ENDPOINT}/amv_monitoristas`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || `Error al crear monitorista: ${resp.status}`);
      }
      const data = await resp.json();
      return {
        id: data.amv_monitoristaid || data.amv_monitoristasid || data.id,
        nombre: data.amv_nombre || payload.amv_nombre,
        correo: data.amv_correo || payload.amv_correo,
        zona: data.amv_zona || payload.amv_zona || '',
      };
    } catch (e) {
      console.error('[createMonitorista] Error:', e);
      throw e;
    }
  }, [getAccessToken]);

  // Actualizar monitorista (amv_monitoristas)
  const updateMonitorista = useCallback(async (id, { amv_nombre, amv_correo, amv_zona }) => {
    const monitoristaId = (id || '').toString().replace(/[{}"]/g, '');
    if (!monitoristaId) throw new Error('Falta id del monitorista');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No se pudo obtener el token de acceso');
      const payload = {};
      if (amv_nombre !== undefined) payload.amv_nombre = (amv_nombre || '').toString().trim();
      if (amv_correo !== undefined) payload.amv_correo = (amv_correo || '').toString().trim();
      if (amv_zona !== undefined) payload.amv_zona = (amv_zona || '').toString().trim() || null;
      const resp = await fetch(`${DATAVERSE_API_ENDPOINT}/amv_monitoristas(${monitoristaId})`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0',
          'If-Match': '*',
        },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || `Error al actualizar monitorista: ${resp.status}`);
      }
      return true;
    } catch (e) {
      console.error('[updateMonitorista] Error:', e);
      throw e;
    }
  }, [getAccessToken]);

  // Listar registros de amv_rols para administración de roles
  const fetchRolesUsuarios = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No se pudo obtener el token de acceso');
      const url = `${DATAVERSE_API_ENDPOINT}/amv_rols?$select=amv_rolid,amv_nombre,amv_correo,amv_sucursal,amv_cargo,amv_rol&$orderby=amv_nombre asc`;
      const resp = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0',
        },
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || `Error al obtener roles de usuarios: ${resp.status}`);
      }
      const data = await resp.json();
      const records = Array.isArray(data.value) ? data.value : [];
      return records.map((r) => ({
        id: r.amv_rolid || r.amv_rolsid || r.id,
        nombre: r.amv_nombre || '',
        correo: r.amv_correo || '',
        sucursal: r.amv_sucursal || '',
        cargo: r.amv_cargo || '',
        rol: r.amv_rol || '',
      }));
    } catch (e) {
      console.error('[fetchRolesUsuarios] Error:', e);
      throw e;
    }
  }, [getAccessToken]);

  // Crear registro en amv_rols
  const createRolUsuario = useCallback(async ({ amv_nombre, amv_correo, amv_sucursal, amv_cargo, amv_rol }) => {
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No se pudo obtener el token de acceso');
      const payload = {
        amv_nombre: (amv_nombre || '').toString().trim(),
        amv_correo: (amv_correo || '').toString().trim(),
        amv_sucursal: (amv_sucursal || '').toString().trim() || null,
        amv_cargo: (amv_cargo || '').toString().trim() || null,
        amv_rol: (amv_rol || '').toString().trim() || null,
      };
      const resp = await fetch(`${DATAVERSE_API_ENDPOINT}/amv_rols`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || `Error al crear rol de usuario: ${resp.status}`);
      }
      const data = await resp.json();
      return {
        id: data.amv_rolid || data.amv_rolsid || data.id,
        nombre: data.amv_nombre || payload.amv_nombre,
        correo: data.amv_correo || payload.amv_correo,
        sucursal: data.amv_sucursal || payload.amv_sucursal || '',
        cargo: data.amv_cargo || payload.amv_cargo || '',
        rol: data.amv_rol || payload.amv_rol || '',
      };
    } catch (e) {
      console.error('[createRolUsuario] Error:', e);
      throw e;
    }
  }, [getAccessToken]);

  // Actualizar registro en amv_rols
  const updateRolUsuario = useCallback(async (id, { amv_nombre, amv_correo, amv_sucursal, amv_cargo, amv_rol }) => {
    const rolId = (id || '').toString().replace(/[{}"]/g, '');
    if (!rolId) throw new Error('Falta id del registro de rol');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No se pudo obtener el token de acceso');
      const payload = {};
      if (amv_nombre !== undefined) payload.amv_nombre = (amv_nombre || '').toString().trim();
      if (amv_correo !== undefined) payload.amv_correo = (amv_correo || '').toString().trim();
      if (amv_sucursal !== undefined) payload.amv_sucursal = (amv_sucursal || '').toString().trim() || null;
      if (amv_cargo !== undefined) payload.amv_cargo = (amv_cargo || '').toString().trim() || null;
      if (amv_rol !== undefined) payload.amv_rol = (amv_rol || '').toString().trim() || null;
      const resp = await fetch(`${DATAVERSE_API_ENDPOINT}/amv_rols(${rolId})`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0',
          'If-Match': '*',
        },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || `Error al actualizar rol de usuario: ${resp.status}`);
      }
      return true;
    } catch (e) {
      console.error('[updateRolUsuario] Error:', e);
      throw e;
    }
  }, [getAccessToken]);

  // Obtener rol de usuario desde amv_rols comparando amv_correo; devuelve 'monitorista' | 'admin' | null
  const fetchUserRoleFromRols = useCallback(async (email) => {
    const safe = (email || '').toString().trim();
    if (!safe) return null;
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No se pudo obtener el token de acceso');
      const sets = ['amv_rols'];
      const filter = `amv_correo eq '${safe.replace(/'/g, "''")}'`;
      let lastErr = null;
      for (const set of sets) {
        try {
          const url = `${DATAVERSE_API_ENDPOINT}/${set}?$select=amv_rol,amv_correo&$filter=${encodeURIComponent(filter)}&$top=1`;
          const resp = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'OData-MaxVersion': '4.0',
              'OData-Version': '4.0'
            }
          });
          if (!resp.ok) {
            const txt = await resp.text();
            lastErr = new Error(txt);
            continue;
          }
          const data = await resp.json();
          const row = Array.isArray(data.value) && data.value.length ? data.value[0] : null;
          if (!row) continue;
          const raw = (row.amv_rol || '').toString().trim().toLowerCase();
          if (!raw) return null;
          if (raw.includes('admin')) return 'admin';
          if (raw.includes('monitorista') || raw.includes('monitor')) return 'monitorista';
          return raw; // fallback por si hay otros valores
        } catch (e) {
          lastErr = e;
          continue;
        }
      }
      if (lastErr) throw lastErr;
      return null;
    } catch (e) {
      console.error('[fetchUserRoleFromRols] Error:', e);
      return null;
    }
  }, [getAccessToken]);

  const fetchTickets = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No se pudo obtener el token de acceso');
      }

      const response = await fetch(
        `${DATAVERSE_API_ENDPOINT}/amv_ticketses?$select=amv_name,amv_asunto,amv_categoriadelasolicitud,amv_estado,amv_prioridad,createdon&$filter=amv_estado ne 'Resuelta'&$expand=createdby($select=fullname)`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0'
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', JSON.stringify(errorData, null, 2));
        throw new Error(`Error al obtener tickets: ${response.status} - ${errorData.error?.message || 'Error desconocido'}`);
      }

      const data = await response.json();
      console.log('Tickets data:', data.value);
      return data.value.map(ticket => ({
        id: ticket.amv_name,
        amv_name: ticket.amv_name,
        amv_asunto: ticket.amv_asunto,
        amv_categoriadelasolicitud: ticket.amv_categoriadelasolicitud,
        amv_estado: ticket.amv_estado,
        amv_prioridad: ticket.amv_prioridad || 'No definida',
        createdon: ticket.createdon,
        createdby: ticket.createdby ? ticket.createdby.fullname : 'No disponible'
      }));
    } catch (error) {
      console.error('Error fetching tickets:', error);
      if (error.message.includes('Authentication failed')) {
        throw error;
      }
      throw error;
    }
  }, [getAccessToken]);

  const fetchClosedTickets = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No se pudo obtener el token de acceso');
      }

      console.log('[fetchClosedTickets] Obteniendo tickets resueltos');

      // Consulta ÚNICAMENTE para tickets con estado "Resuelta"
      const response = await fetch(
        `${DATAVERSE_API_ENDPOINT}/amv_ticketses?$select=amv_name,amv_categoriadelasolicitud,amv_fechadecierre,amv_asunto,createdon,amv_estado&$filter=amv_estado eq 'Resuelta'&$expand=createdby($select=fullname)&$orderby=amv_fechadecierre desc`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0'
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[fetchClosedTickets] Error en la respuesta:', errorData);
        throw new Error(`Error al obtener tickets resueltos: ${response.status}`);
      }

      const data = await response.json();
      console.log('[fetchClosedTickets] Datos recibidos:', data.value);
      console.log('[fetchClosedTickets] Total de tickets encontrados:', data.value.length);
      
      // Verificar que todos los tickets tienen el estado "Resuelta"
      const ticketsWithCorrectStatus = data.value.filter(ticket => ticket.amv_estado === "Resuelta");
      console.log('[fetchClosedTickets] Tickets con estado "Resuelta":', ticketsWithCorrectStatus.length);
      
      if (ticketsWithCorrectStatus.length !== data.value.length) {
        console.warn('[fetchClosedTickets] Hay tickets que no tienen el estado "Resuelta"');
      }
      
      // Asegurarnos de que los tickets estén ordenados por fecha de cierre descendente
      const sortedTickets = data.value
        .map(ticket => ({
          amv_name: ticket.amv_name,
          createdby: ticket.createdby ? ticket.createdby.fullname : 'No disponible',
          amv_categoriadelasolicitud: ticket.amv_categoriadelasolicitud,
          amv_asunto: ticket.amv_asunto,
          createdon: ticket.createdon,
          amv_fechadecierre: ticket.amv_fechadecierre,
          // Asegurar que el estado siempre sea exactamente "Resuelta"
          amv_estado: "Resuelta"
        }))
        .sort((a, b) => {
          // Si alguna fecha es null o undefined, ponerla al final
          if (!a.amv_fechadecierre) return 1;
          if (!b.amv_fechadecierre) return -1;
          // Ordenar de más reciente a más antigua
          return new Date(b.amv_fechadecierre) - new Date(a.amv_fechadecierre);
        });

      console.log('[fetchClosedTickets] Tickets ordenados:', sortedTickets);
      return sortedTickets;
    } catch (error) {
      console.error('[fetchClosedTickets] Error:', error);
      throw error;
    }
  }, [getAccessToken]);

  const fetchReportData = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No se pudo obtener el token de acceso');
      }

      const response = await fetch(
        `${DATAVERSE_API_ENDPOINT}/amv_ticketses?$select=amv_sucursal,amv_categoriadelasolicitud,createdon&$orderby=createdon desc`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Error al obtener datos para reportes: ${response.status}`);
      }

      const data = await response.json();
      return data.value;
    } catch (error) {
      console.error('Error fetching report data:', error);
      throw error;
    }
  }, [getAccessToken]);

  const fetchTicketAttachments = useCallback(async (ticketId) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No se pudo obtener el token de acceso');
      }

      console.log('Fetching attachments for ticket:', ticketId);
      const response = await fetch(
        `${DATAVERSE_API_ENDPOINT}/amv_archivoses?$filter=_amv_ticketrelacion_value eq ${ticketId}&$select=amv_id,amv_imagen`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0'
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', JSON.stringify(errorData, null, 2));
        throw new Error(`Error al obtener archivos adjuntos: ${response.status} - ${errorData.error?.message || 'Error desconocido'}`);
      }

      const data = await response.json();
      console.log('Attachments data:', JSON.stringify(data, null, 2));
      
      if (!data.value || data.value.length === 0) {
        return [];
      }

      return data.value.map(attachment => ({
        id: attachment.amv_id,
        image: attachment.amv_imagen
      }));
    } catch (error) {
      console.error('Error fetching ticket attachments:', error);
      return [];
    }
  }, [getAccessToken]);
  const fetchTicketAnnotations = useCallback(async (ticketId) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No se pudo obtener el token de acceso');
      }

      console.log('Fetching annotations for ticket:', ticketId);
      const response = await fetch(
        `${DATAVERSE_API_ENDPOINT}/annotations?$filter=_objectid_value eq ${ticketId}&$select=subject,filename,mimetype,documentbody`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0'
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', JSON.stringify(errorData, null, 2));
        throw new Error(`Error al obtener anotaciones: ${response.status} - ${errorData.error?.message || 'Error desconocido'}`);
      }

      const data = await response.json();
      console.log('Annotations data:', JSON.stringify(data, null, 2));
      
      if (!data.value || data.value.length === 0) {
        return [];
      }

      return data.value.map(annotation => ({
        annotationid: annotation.annotationid,
        subject: annotation.subject,
        filename: annotation.filename,
        mimetype: annotation.mimetype,
        documentbody: annotation.documentbody
      }));
    } catch (error) {
      console.error('Error fetching ticket annotations:', error);
      throw error;
    }
  }, [getAccessToken]);
  
  const fetchTicketDetails = useCallback(async (ticketId) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No se pudo obtener el token de acceso');
      }

      console.log('Fetching ticket with ID:', ticketId);
      const response = await fetch(
        `${DATAVERSE_API_ENDPOINT}/amv_ticketses?$filter=amv_name eq '${encodeURIComponent(ticketId)}'&$select=amv_ticketsid,amv_name,amv_asunto,amv_categoriadelasolicitud,amv_estado,amv_prioridad,amv_descripcion,amv_correo,amv_sucursal,amv_telefono,amv_solicitudanombrede,createdon&$expand=createdby($select=fullname)`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0'
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', JSON.stringify(errorData, null, 2));
        throw new Error(`Error al obtener detalles del ticket: ${response.status} - ${errorData.error?.message || 'Error desconocido'}`);
      }

      const data = await response.json();
      console.log('Response data:', JSON.stringify(data, null, 2));
      
      if (!data.value || data.value.length === 0) {
        throw new Error('No se encontró el ticket');
      }

      const ticket = data.value[0];
      const attachments = await fetchTicketAttachments(ticket.amv_ticketsid);

      return {
        id: ticket.amv_name,
        amv_ticketsid: ticket.amv_ticketsid,
        amv_name: ticket.amv_name,
        amv_asunto: ticket.amv_asunto,
        amv_categoriadelasolicitud: ticket.amv_categoriadelasolicitud,
        amv_estado: ticket.amv_estado,
        amv_prioridad: ticket.amv_prioridad || '',
        amv_descripcion: ticket.amv_descripcion,
        amv_correo: ticket.amv_correo,
        amv_sucursal: ticket.amv_sucursal,
        amv_telefono: ticket.amv_telefono,
        amv_solicitudanombrede: ticket.amv_solicitudanombrede || '',
        createdon: ticket.createdon,
        createdby: ticket.createdby ? ticket.createdby.fullname : 'No disponible',
        attachments
      };
    } catch (error) {
      console.error('Error fetching ticket details:', error);
      throw error;
    }
  }, [getAccessToken, fetchTicketAttachments]);

  // Fetch attentions for a specific ticket
  const fetchAttentions = useCallback(async (ticketId) => {
    if (!ticketId) {
      console.warn('No se proporcionó un ID de ticket para fetchAttentions');
      return [];
    }

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No se pudo obtener el token de acceso');
      }

      console.log('[fetchAttentions] Obteniendo atenciones para el ticket:', ticketId);

      const response = await fetch(
        `${DATAVERSE_API_ENDPOINT}/amv_atencions?$filter=_amv_tickets_value eq ${ticketId}&$select=amv_atencionid,amv_comentarios,createdon&$expand=createdby($select=fullname)&$orderby=createdon desc`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0'
          },
        }
      );

      if (!response.ok) {
        console.error('[fetchAttentions] Error en la respuesta:', response.status);
        return [];
      }

      const data = await response.json();
      const attentions = data.value;

      // Obtener anotaciones para cada atención
      const attentionsWithAnnotations = await Promise.all(
        attentions.map(async (attention) => {
          try {
            console.log('[fetchAttentions] Obteniendo anotaciones para la atención:', attention.amv_atencionid);
            
            const annotationsResponse = await fetch(
              `${DATAVERSE_API_ENDPOINT}/annotations?$filter=_objectid_value eq ${attention.amv_atencionid} and objecttypecode eq 'amv_atencion'&$select=filename,mimetype,documentbody`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                  'OData-MaxVersion': '4.0',
                  'OData-Version': '4.0'
                },
              }
            );

            if (!annotationsResponse.ok) {
              console.error('[fetchAttentions] Error al obtener anotaciones:', annotationsResponse.status);
              return {
                ...attention,
                createdby: attention.createdby ? attention.createdby.fullname : 'No disponible',
                amv_anotacion: null
              };
            }

            const annotationsData = await annotationsResponse.json();
            const annotation = annotationsData.value[0]; // Tomamos la primera anotación

            return {
              ...attention,
              createdby: attention.createdby ? attention.createdby.fullname : 'No disponible',
              amv_anotacion: annotation ? {
                filename: annotation.filename,
                mimetype: annotation.mimetype,
                fileContent: annotation.documentbody
              } : null
            };
          } catch (error) {
            console.error('[fetchAttentions] Error al procesar anotación:', error);
            return {
        ...attention,
              createdby: attention.createdby ? attention.createdby.fullname : 'No disponible',
              amv_anotacion: null
            };
          }
        })
      );

      console.log('[fetchAttentions] Atenciones con anotaciones:', attentionsWithAnnotations);
      return attentionsWithAnnotations;
    } catch (error) {
      console.error('[fetchAttentions] Error general:', error);
      return [];
    }
  }, [getAccessToken]);

  // Create a new attention record
  const createAttention = useCallback(async (attentionData) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No se pudo obtener el token de acceso');
      }

      // Log the request data for debugging
      console.log('Creating attention with data:', {
        ticketId: attentionData.amv_tickets,
        comentarios: attentionData.amv_comentarios
      });

      const payload = {
        amv_comentarios: attentionData.amv_comentarios,
        "amv_Tickets@odata.bind": `/amv_ticketses(${attentionData.amv_tickets})`
      };

      console.log('Sending payload:', payload);

      const response = await fetch(
        `${DATAVERSE_API_ENDPOINT}/amv_atencions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response from Dataverse:', errorData);
        throw new Error(errorData.error?.message || 'Error al crear la atención');
      }

      const data = await response.json();
      console.log('Attention created successfully:', data);
      return data;
    } catch (error) {
      console.error('Error creating attention:', error);
      throw error;
    }
  }, [getAccessToken]);

  // Close a ticket
  const closeTicket = useCallback(async (ticketId) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No se pudo obtener el token de acceso');
      }

      console.log('[closeTicket] Intentando cerrar ticket:', ticketId);

      // Obtener la fecha actual en formato ISO
      const currentDate = new Date().toISOString();
      console.log('[closeTicket] Fecha de cierre:', currentDate);

      // Verificar que el ID del ticket tenga el formato correcto (GUID sin comillas ni llaves)
      let formattedTicketId = ticketId;
      // Si el ID tiene llaves, las eliminamos
      if (formattedTicketId.startsWith('{') && formattedTicketId.endsWith('}')) {
        formattedTicketId = formattedTicketId.slice(1, -1);
      }
      // Asegurar que no tiene comillas alrededor
      formattedTicketId = formattedTicketId.replace(/"/g, '');

      console.log('[closeTicket] ID de ticket formateado:', formattedTicketId);

      // Preparar los datos para actualizar
      const ticketData = {
        'amv_estado': "Resuelta",
        'amv_fechadecierre': currentDate
      };
      
      console.log('[closeTicket] Datos a enviar:', JSON.stringify(ticketData, null, 2));

      const response = await fetch(
        `${DATAVERSE_API_ENDPOINT}/amv_ticketses(${formattedTicketId})`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'If-Match': '*'
          },
          body: JSON.stringify(ticketData),
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        console.error('[closeTicket] Error en la respuesta:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(`Error al cerrar el ticket: ${response.status} - ${response.statusText}`);
      }

      console.log('[closeTicket] Ticket cerrado exitosamente con estado "Resuelta"');
      
      // Verificar que el estado se haya actualizado correctamente
      try {
        // Esperar un momento para asegurar que la actualización se ha propagado
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const verifyResponse = await fetch(
          `${DATAVERSE_API_ENDPOINT}/amv_ticketses(${formattedTicketId})?$select=amv_estado`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'OData-MaxVersion': '4.0',
              'OData-Version': '4.0'
            },
          }
        );
        
        if (verifyResponse.ok) {
          const verifyData = await verifyResponse.json();
          console.log('[closeTicket] Verificación de estado:', verifyData.amv_estado);
          
          if (verifyData.amv_estado !== "Resuelta") {
            console.warn('[closeTicket] ADVERTENCIA: El estado no se actualizó a "Resuelta", intentando de nuevo...');
            
            // Intentar nuevamente la actualización
            const retryResponse = await fetch(
              `${DATAVERSE_API_ENDPOINT}/amv_ticketses(${formattedTicketId})`,
              {
                method: 'PATCH',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                  'OData-MaxVersion': '4.0',
                  'OData-Version': '4.0',
                  'If-Match': '*'
                },
                body: JSON.stringify({
                  'amv_estado': "Resuelta"
                }),
              }
            );
            
            if (retryResponse.ok) {
              console.log('[closeTicket] Segundo intento exitoso');
            } else {
              console.warn('[closeTicket] El segundo intento también falló');
            }
          }
        }
      } catch (verifyError) {
        console.warn('[closeTicket] Error al verificar el estado:', verifyError);
        // No lanzamos el error para que no interrumpa el flujo principal
      }
      
      return true;
    } catch (error) {
      console.error('[closeTicket] Error al cerrar ticket:', error);
      throw error;
    }
  }, [getAccessToken]);

  // Actualizar el estado del ticket a "En revisión"
  const updateTicketStatus = useCallback(async (ticketId, status, priority = null) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No se pudo obtener el token de acceso');
      }

      console.log('[updateTicketStatus] Actualizando ticket:', ticketId, 'estado:', status, 'prioridad:', priority);

      // Verificar que el ID del ticket tenga el formato correcto (GUID sin comillas ni llaves)
      let formattedTicketId = ticketId;
      // Si el ID tiene llaves, las eliminamos
      if (formattedTicketId.startsWith('{') && formattedTicketId.endsWith('}')) {
        formattedTicketId = formattedTicketId.slice(1, -1);
      }
      // Asegurar que no tiene comillas alrededor
      formattedTicketId = formattedTicketId.replace(/"/g, '');

      console.log('[updateTicketStatus] ID de ticket formateado:', formattedTicketId);

      // Prepare update data
      const updateData = {
        'amv_estado': status
      };
      
      // Add priority to update data if provided
      if (priority !== null) {
        updateData['amv_prioridad'] = priority;
      }

      console.log('[updateTicketStatus] Datos a actualizar:', updateData);

      const response = await fetch(
        `${DATAVERSE_API_ENDPOINT}/amv_ticketses(${formattedTicketId})`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'If-Match': '*'
          },
          body: JSON.stringify(updateData),
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        console.error('[updateTicketStatus] Error en la respuesta:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(`Error al actualizar el ticket: ${response.status} - ${response.statusText}`);
      }

      console.log('[updateTicketStatus] Ticket actualizado exitosamente');
      return true;
    } catch (error) {
      console.error('[updateTicketStatus] Error al actualizar ticket:', error);
      throw error;
    }
  }, [getAccessToken]);

  // Upload file to Dataverse as annotation
  const uploadFileToDataverse = useCallback(async ({ filename, mimetype, fileContent, objectid_amv_atencion }) => {
    try {
      console.log('[uploadFileToDataverse] Iniciando subida de archivo:', {
        filename,
        mimetype,
        objectid_amv_atencion,
        fileContentLength: fileContent.length
      });

      const token = await getAccessToken();
      if (!token) {
        console.error('[uploadFileToDataverse] Error: No se pudo obtener el token de acceso');
        throw new Error('No se pudo obtener el token de acceso');
      }

      // Asegurarse de que el contenido del archivo esté en el formato correcto
      const base64Content = fileContent.replace(/^data:.*,/, '');
      console.log('[uploadFileToDataverse] Contenido del archivo convertido a base64:', {
        base64Length: base64Content.length,
        first50Chars: base64Content.substring(0, 50) + '...'
      });

      const annotationData = {
        subject: `Archivo adjunto: ${filename}`,
        filename: filename,
        mimetype: mimetype,
        documentbody: base64Content,
        "objecttypecode": "amv_atencion",
        "objectid_amv_atencion@odata.bind": `/amv_atencions(${objectid_amv_atencion})`
      };

      console.log('[uploadFileToDataverse] Enviando datos de anotación:', {
        ...annotationData,
        documentbody: 'BASE64_CONTENT' // No mostramos el contenido completo en el log
      });

      console.log('[uploadFileToDataverse] Realizando petición POST a:', `${DATAVERSE_API_ENDPOINT}/annotations`);

      const response = await fetch(
        `${DATAVERSE_API_ENDPOINT}/annotations`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(annotationData),
        }
      );

      console.log('[uploadFileToDataverse] Respuesta recibida:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[uploadFileToDataverse] Error en la respuesta:', {
          status: response.status,
          errorData
        });
        throw new Error(errorData.error?.message || 'Error al subir el archivo');
      }

      const data = await response.json();
      console.log('[uploadFileToDataverse] Archivo subido exitosamente:', {
        annotationId: data.annotationid,
        filename: data.filename
      });
      return data;
    } catch (error) {
      console.error('[uploadFileToDataverse] Error en el proceso de subida:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }, [getAccessToken]);

  // Actualiza amv_ticketvehicular (estado)
  const updateVehicularTicketStatus = useCallback(async (ticketVehicularId, status) => {
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No se pudo obtener el token de acceso');
      if (!ticketVehicularId) throw new Error('Falta ticketVehicularId');
      const formattedId = String(ticketVehicularId).replace(/[{}"]/g, '');
      const body = { amv_estado: status };
      const resp = await fetch(`${DATAVERSE_API_ENDPOINT}/amv_ticketvehiculars(${formattedId})`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0',
          'If-Match': '*'
        },
        body: JSON.stringify(body)
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Error al actualizar estado: ${resp.status} ${resp.statusText} - ${txt}`);
      }
      return true;
    } catch (e) {
      console.error('[updateVehicularTicketStatus] Error:', e);
      throw e;
    }
  }, [getAccessToken]);

  // Actualiza amv_ticketvehicular con campos arbitrarios (por ejemplo amv_aprueba y/o amv_estado)
  const updateVehicularTicketFields = useCallback(async (ticketVehicularId, fields) => {
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No se pudo obtener el token de acceso');
      if (!ticketVehicularId) throw new Error('Falta ticketVehicularId');
      if (!fields || typeof fields !== 'object') throw new Error('Faltan campos a actualizar');
      const formattedId = String(ticketVehicularId).replace(/[{}"]/g, '');
      const resp = await fetch(`${DATAVERSE_API_ENDPOINT}/amv_ticketvehiculars(${formattedId})`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0',
          'If-Match': '*'
        },
        body: JSON.stringify(fields)
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Error al actualizar ticket vehicular: ${resp.status} ${resp.statusText} - ${txt}`);
      }
      return true;
    } catch (e) {
      console.error('[updateVehicularTicketFields] Error:', e);
      throw e;
    }
  }, [getAccessToken]);

  // Obtener correo por cargo desde amv_rols (e.g., "Jefe de Parque Vehicular")
  const fetchRoleEmailByCargo = useCallback(async (cargoName) => {
    const safeCargo = (cargoName || '').toString().trim();
    if (!safeCargo) throw new Error('Cargo inválido');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No se pudo obtener el token de acceso');
      const sets = ['amv_rols'];
      const filter = `amv_cargo eq '${safeCargo.replace(/'/g, "''")}'`;
      let lastErr = null;
      for (const set of sets) {
        try {
          const url = `${DATAVERSE_API_ENDPOINT}/${set}?$select=amv_correo,amv_cargo&$filter=${encodeURIComponent(filter)}&$top=1`;
          const resp = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'OData-MaxVersion': '4.0',
              'OData-Version': '4.0'
            }
          });
          if (!resp.ok) {
            const txt = await resp.text();
            lastErr = new Error(txt);
            continue;
          }
          const data = await resp.json();
          const row = Array.isArray(data.value) && data.value.length ? data.value[0] : null;
          if (row?.amv_correo) return row.amv_correo;
        } catch (e) {
          lastErr = e;
          continue;
        }
      }
      if (lastErr) throw lastErr;
      return null;
    } catch (e) {
      console.error('[fetchRoleEmailByCargo] Error:', e);
      throw e;
    }
  }, [getAccessToken]);

  // Diagnósticos asociados a un ticket vehicular (lookup _amv_ticketvehicular_value)
  const fetchVehicularDiagnosticos = useCallback(async (ticketVehicularId) => {
    if (!ticketVehicularId) return [];
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No se pudo obtener el token de acceso');
      // Traer campos necesarios + proveedor (amv_proveedor) con su nombre principal (amv_name)
      const url = `${DATAVERSE_API_ENDPOINT}/amv_diagnosticos` +
        `?$select=amv_diagnostico,amv_monto,amv_diasdecredito,amv_iniciocredito,createdon,_amv_proveedor_value` +
        `&$expand=amv_proveedor($select=amv_name)` +
        `&$filter=_amv_ticketvehicular_value eq ${ticketVehicularId}` +
        `&$orderby=createdon desc`;
      const resp = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0',
          // Incluir nombre formateado de lookups (primary name del proveedor)
          'Prefer': 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"'
        }
      });
      if (!resp.ok) {
        const txt = await resp.text();
        console.warn('[fetchVehicularDiagnosticos] Respuesta no OK:', resp.status, txt);
        return [];
      }
      const data = await resp.json();
      const arr = Array.isArray(data.value) ? data.value : [];
      return arr.map(r => ({
        id: r.amv_diagnosticoid || r.amv_diagnosticosid || r.id || r.amv_diagnostico || '',
        amv_diagnostico: r.amv_diagnostico || '',
        amv_monto: r.amv_monto ?? r.monto ?? null,
        amv_diasdecredito: r.amv_diasdecredito ?? r.amv_dias_credito ?? r.dias_credito ?? null,
        amv_iniciocredito: r.amv_iniciocredito ?? r.amv_inicio_credito ?? r.dia_inicio_credito ?? null,
        proveedorId: r?._amv_proveedor_value || null,
        // Prioriza el nombre formateado de lookup; si no existe, usa el expand
        proveedorName: r['_amv_proveedor_value@OData.Community.Display.V1.FormattedValue'] || r?.amv_proveedor?.amv_name || null,
        createdon: r.createdon || null
      }));
    } catch (e) {
      console.error('[fetchVehicularDiagnosticos] Error:', e);
      return [];
    }
  }, [getAccessToken]);

  // Diagnósticos por el "folio" amv_ticket del ticket vehicular:
  // Paso 1: obtener GUID del ticket vehicular por amv_ticket
  // Paso 2: listar diagnósticos filtrando por _amv_ticketvehicular_value = GUID
  const fetchVehicularDiagnosticosByTicketCode = useCallback(async (ticketCode) => {
    const code = (ticketCode || '').toString().trim();
    if (!code) return [];
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No se pudo obtener el token de acceso');
      const safe = code.replace(/'/g, "''");
      // Paso 1: buscar ticket vehicular
      const tkUrl = `${DATAVERSE_API_ENDPOINT}/amv_ticketvehiculars?$select=amv_ticketvehicularid&$filter=amv_ticket eq '${safe}'&$top=1`;
      const tkResp = await fetch(tkUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        }
      });
      if (!tkResp.ok) {
        const txt = await tkResp.text();
        console.warn('[fetchVehicularDiagnosticosByTicketCode] No se pudo obtener ticket vehicular por amv_ticket:', tkResp.status, txt);
        return [];
      }
      const tkData = await tkResp.json();
      const item = Array.isArray(tkData.value) && tkData.value.length ? tkData.value[0] : null;
      const guid = item?.amv_ticketvehicularid;
      if (!guid) return [];
      // Paso 2: listar diagnósticos por lookup
      return await fetchVehicularDiagnosticos(guid);
    } catch (e) {
      console.error('[fetchVehicularDiagnosticosByTicketCode] Error:', e);
      return [];
    }
  }, [getAccessToken, fetchVehicularDiagnosticos]);

  // Crear diagnóstico asociado a un ticket vehicular (lookup)
  // Permite asociar por GUID (ticketVehicularId) o, si no viene, por código 'amv_ticket' (ticketCode)
  const createVehicularDiagnostico = useCallback(async ({ ticketVehicularId, ticketCode, amv_diagnostico, amv_monto, amv_diasdecredito, amv_iniciocredito, proveedorId }) => {
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No se pudo obtener el token de acceso');
      // Resolver GUID del ticket: usar el provisto o buscar por amv_ticket
      let guid = (ticketVehicularId || '').toString().replace(/[{}"]/g, '');
      if (!guid && ticketCode) {
        const safe = String(ticketCode).replace(/'/g, "''");
        const tkUrl = `${DATAVERSE_API_ENDPOINT}/amv_ticketvehiculars?$select=amv_ticketvehicularid&$filter=amv_ticket eq '${safe}'&$top=1`;
        const tkResp = await fetch(tkUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0'
          }
        });
        if (tkResp.ok) {
          const tkData = await tkResp.json();
          const item = Array.isArray(tkData.value) && tkData.value.length ? tkData.value[0] : null;
          guid = (item?.amv_ticketvehicularid || '').toString().replace(/[{}"]/g, '');
        }
      }
      if (!guid) throw new Error('Falta ticketVehicularId (no se encontró por amv_ticket)');
      // Navegación y nombres de campos definitivos
      const navCandidates = ['amv_ticketvehicular'];
      const diasCandidates = ['amv_diasdecredito']; // evitar 'amv_dias_credito' (no existe)
      const inicioCandidates = ['amv_iniciocredito'];
      let lastErr = null;
      // Candidate navigation names for lookup to ticket vehicular (usar solo minúsculas)
      for (const nav of navCandidates) {
        for (const diasKey of diasCandidates) {
          for (const inicioKey of inicioCandidates) {
        const payload = {
              // siempre texto del diagnóstico
              amv_diagnostico: amv_diagnostico || '',
          ...(amv_monto !== undefined && amv_monto !== null ? { amv_monto: Number(amv_monto) } : {}),
              ...(amv_diasdecredito !== undefined && amv_diasdecredito !== null && amv_diasdecredito !== ''
                ? { [diasKey]: Number(amv_diasdecredito) }
                : {}),
              ...(amv_iniciocredito !== undefined && amv_iniciocredito !== null && amv_iniciocredito !== ''
                ? { [inicioKey]: String(amv_iniciocredito) }
                : {}),
          [`${nav}@odata.bind`]: `/amv_ticketvehiculars(${guid})`
        };
            // asociar proveedor directamente por lookup amv_proveedor
        if (proveedorId) {
              const provGuid = String(proveedorId).replace(/[{}"]/g, '');
              payload[`amv_proveedor@odata.bind`] = `/amv_proveedors(${provGuid})`;
        }
        try {
          const resp = await fetch(`${DATAVERSE_API_ENDPOINT}/amv_diagnosticos`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'OData-MaxVersion': '4.0',
              'OData-Version': '4.0',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(payload)
          });
          if (!resp.ok) {
                let txt = '';
                try {
                  const err = await resp.json();
                  txt = JSON.stringify(err);
                } catch {
                  txt = await resp.text();
                }
                console.warn(`[createVehicularDiagnostico] Falló con nav '${nav}', diasKey '${diasKey}', inicioKey '${inicioKey}':`, resp.status, txt);
            lastErr = new Error(txt);
            continue;
          }
          const data = await resp.json();

          return {
            id: data.amv_diagnosticoid || data.amv_diagnosticosid || data.id,
            amv_diagnostico: data.amv_diagnostico || amv_diagnostico || '',
            amv_monto: data.amv_monto ?? amv_monto ?? null,
                amv_diasdecredito: data[diasKey] ?? amv_diasdecredito ?? null,
                amv_iniciocredito: data[inicioKey] ?? amv_iniciocredito ?? null,
            createdon: data.createdon || new Date().toISOString()
          };
        } catch (e) {
              console.warn(`[createVehicularDiagnostico] Excepción con nav '${nav}', diasKey '${diasKey}', inicioKey '${inicioKey}':`, e?.message || e);
          lastErr = e;
          continue;
            }
          }
        }
      }
      throw lastErr || new Error('No se pudo crear el diagnóstico');
    } catch (e) {
      console.error('[createVehicularDiagnostico] Error:', e);
      throw e;
    }
  }, [getAccessToken]);

  // Buscar proveedores por nombre (para asociar en diagnóstico)
  const searchProveedoresByNombre = useCallback(async (query) => {
    const q = (query || '').toString().trim();
    if (!q) return [];
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No se pudo obtener el token de acceso');
      const safe = q.replace(/'/g, "''");
      // Limitar a entity set existente para evitar 404 en entornos donde no existen pluralizaciones alternativas
      const sets = ['amv_proveedors'];
      for (const setName of sets) {
        const url = `${DATAVERSE_API_ENDPOINT}/${setName}?$select=amv_proveedorid,amv_name&$filter=contains(amv_name,'${safe}')&$top=10&$orderby=amv_name asc`;
        const resp = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0'
          }
        });
        if (!resp.ok) continue;
        const data = await resp.json();
        const arr = Array.isArray(data.value) ? data.value : [];
        if (arr.length) {
          return arr.map(p => ({
            id: p.amv_proveedorid || p.amv_proveedorsid || p.id,
            name: p.amv_name || ''
          }));
        }
      }
      return [];
    } catch (e) {
      console.error('[searchProveedoresByNombre] Error:', e);
      return [];
    }
  }, [getAccessToken]);

  // Crear proveedor (amv_proveedors) usando columna principal amv_name
  // Compatibilidad: acepta amv_name o amv_nombre como fuente del nombre
  const createProveedor = useCallback(async ({ amv_name, amv_nombre, amv_ubicacion, amv_direccion, amv_correo, amv_telefono }) => {
    const nombre = (amv_name ?? amv_nombre ?? '').toString().trim();
    if (!nombre) throw new Error('El nombre del proveedor es requerido');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No se pudo obtener el token de acceso');
      const sets = ['amv_proveedors'];
      let lastErr = null;
      for (const setName of sets) {
        try {
          const payload = {
            amv_name: nombre,
            ...(amv_ubicacion ? { amv_ubicacion: amv_ubicacion.toString() } : {}),
            ...(amv_direccion ? { amv_direccion: amv_direccion.toString() } : {}),
            ...(amv_correo ? { amv_correo: amv_correo.toString() } : {}),
            ...(amv_telefono ? { amv_telefono: amv_telefono.toString() } : {}),
          };
          const resp = await fetch(`${DATAVERSE_API_ENDPOINT}/${setName}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'OData-MaxVersion': '4.0',
              'OData-Version': '4.0',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(payload)
          });
          if (!resp.ok) {
            const txt = await resp.text();
            lastErr = new Error(txt);
            continue;
          }
          const data = await resp.json();
          return {
            id: data.amv_proveedorid || data.amv_proveedorsid || data.id,
            name: data.amv_name || nombre
          };
        } catch (e) {
          lastErr = e;
          continue;
        }
      }
      throw lastErr || new Error('No se pudo crear el proveedor');
    } catch (e) {
      console.error('[createProveedor] Error:', e);
      throw e;
    }
  }, [getAccessToken]);

  // Eliminar proveedor por id (rollback en caso de fallos al subir documentos)
  const deleteProveedor = useCallback(async (proveedorId) => {
    const guid = (proveedorId || '').toString().replace(/[{}"]/g, '');
    if (!guid) throw new Error('Falta id del proveedor');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No se pudo obtener el token de acceso');
      const setName = 'amv_proveedors';
      const resp = await fetch(`${DATAVERSE_API_ENDPOINT}/${setName}(${guid})`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        }
      });
      if (!resp.ok && resp.status !== 204) {
        const txt = await resp.text();
        throw new Error(txt || `DELETE ${resp.status}`);
      }
      return true;
    } catch (e) {
      console.error('[deleteProveedor] Error:', e);
      throw e;
    }
  }, [getAccessToken]);

  return {
    fetchVehicularTickets,
    fetchResolvedVehicularTickets,
    fetchVehicularTicketByCode,
    fetchVehicularInteractions,
    createVehicularInteraction,
    fetchVehicularDiagnosticos,
    fetchVehicularDiagnosticosByTicketCode,
    createVehicularDiagnostico,
    updateVehicularDiagnostico,
    deleteVehicularDiagnostico,
    searchProveedoresByNombre,
    createProveedor,
    deleteProveedor,
    fetchVehicularFiles,
    downloadVehicularFile,
    fetchMonitoristaZonaByEmail,
    fetchMonitoristas,
    createMonitorista,
    updateMonitorista,
    fetchRolesUsuarios,
    createRolUsuario,
    updateRolUsuario,
    fetchUserRoleFromRols,
    fetchTickets,
    fetchClosedTickets,
    fetchReportData,
    fetchTicketDetails,
    fetchTicketAnnotations,
    fetchAttentions,
    createAttention,
    closeTicket,
    updateTicketStatus,
    updateVehicularTicketStatus,
    updateVehicularTicketFields,
    fetchRoleEmailByCargo,
    uploadFileToDataverse,
  };
} 