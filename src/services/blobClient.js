export function createBlobClient(apiBase) {
  async function safeJson(res) {
    const t = await res.text();
    try { return t ? JSON.parse(t) : {}; } catch { return {}; }
  }

  async function getUploadSas({ fileName, contentType, folder }) {
    const res = await fetch(`${apiBase}/blob/sas-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, contentType, folder })
    });
    if (!res.ok) throw new Error((await safeJson(res)).error || `SAS upload ${res.status}`);
    return res.json(); // { uploadUrl, blobUrl, blobName }
  }

  // Variante personalizada: /blob/sas-upload-custom
  async function getUploadSasCustom({ fileName, contentType, folder }) {
    const res = await fetch(`${apiBase}/blob/sas-upload-custom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, contentType, folder })
    });
    if (!res.ok) throw new Error((await safeJson(res)).error || `SAS upload custom ${res.status}`);
    return res.json(); // { uploadUrl, blobUrl, blobName }
  }

  // SAS para proveedor con documentType
  async function getUploadSasProvider({ fileName, contentType, providerId, documentType }) {
    // Intento 1: con prefijo /blob
    let res = await fetch(`${apiBase}/blob/sas-upload-provider`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, contentType, providerId, documentType })
    });
    if (!res.ok) {
      // Capturar mensaje del primer intento
      let firstErr = '';
      try { firstErr = (await safeJson(res)).error || ''; } catch {}
      // Fallback sin /blob (aplicar también en 5xx)
      const res2 = await fetch(`${apiBase}/sas-upload-provider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, contentType, providerId, documentType })
      });
      if (!res2.ok) {
        const secondErr = (await safeJson(res2)).error || firstErr || `SAS upload provider ${res2.status}`;
        throw new Error(secondErr);
      }
      return res2.json();
    }
    return res.json(); // { uploadUrl, blobUrl, blobName }
  }

  async function putToAzure(uploadUrl, file) {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': file.type || 'application/octet-stream'
      },
      body: await file.arrayBuffer()
    });
    if (!res.ok) throw new Error(await res.text() || `PUT ${res.status}`);
  }

  async function getReadSas(blobName) {
    const res = await fetch(`${apiBase}/blob/sas-read?blobName=${encodeURIComponent(blobName)}`);
    if (!res.ok) throw new Error((await safeJson(res)).error || `SAS read ${res.status}`);
    return res.json(); // { downloadUrl, blobUrl }
  }

  async function listByPrefix(prefix) {
    const tryList = async (param) => {
      const url = `${apiBase}/blob/list?${param}=${encodeURIComponent(prefix)}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      const arr = data.items || data.blobs || data.value || [];
      return arr.map(it => {
        const name = it.name || it.blobName || '';
        const fileName = decodeURIComponent((name || '').split('/').pop() || '');
        return {
          name, blobName: name, fileName,
          size: it.size ?? it.contentLength ?? null,
          contentType: it.contentType || null,
          lastModified: it.lastModified || it.last_modified || null,
          blobUrl: it.blobUrl || it.url || null
        };
      });
    };
    return (await tryList('prefix')) || (await tryList('folder')) || [];
  }

  async function uploadFilesWithSas(files, { folder, onProgress } = {}) {
    const results = [], errors = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      onProgress?.(`Subiendo ${f.name} (${i + 1}/${files.length})`);
      try {
        const { uploadUrl, blobUrl, blobName } = await getUploadSas({
          fileName: f.name, contentType: f.type || 'application/octet-stream', folder
        });
        await putToAzure(uploadUrl, f);
        results.push({ fileName: f.name, blobName, blobUrl });
      } catch (e) {
        errors.push(`${f.name}: ${e.message || 'Error desconocido'}`);
      }
    }
    onProgress?.('');
    return { okCount: results.length, failCount: errors.length, errors, results };
  }

  // Variante usando /blob/sas-upload-custom
  async function uploadFilesWithSasCustom(files, { folder, onProgress } = {}) {
    const results = [], errors = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      onProgress?.(`Subiendo ${f.name} (${i + 1}/${files.length})`);
      try {
        const { uploadUrl, blobUrl, blobName } = await getUploadSasCustom({
          fileName: f.name, contentType: f.type || 'application/octet-stream', folder
        });
        await putToAzure(uploadUrl, f);
        results.push({ fileName: f.name, blobName, blobUrl });
      } catch (e) {
        errors.push(`${f.name}: ${e.message || 'Error desconocido'}`);
      }
    }
    onProgress?.('');
    return { okCount: results.length, failCount: errors.length, errors, results };
  }

  // Subir UN archivo de proveedor a partir del documentType
  async function uploadProviderDocument({ providerId, documentType, file, onProgress }) {
    if (!providerId) throw new Error('providerId requerido');
    if (!documentType) throw new Error('documentType requerido');
    if (!file) throw new Error('file requerido');
    onProgress?.(`Subiendo ${file.name}`);
    const { uploadUrl, blobUrl, blobName } = await getUploadSasProvider({
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      providerId,
      documentType
    });
    await putToAzure(uploadUrl, file);
    onProgress?.('');
    return { blobName, blobUrl };
  }

  async function openFile(blobName) {
    const { downloadUrl } = await getReadSas(blobName);
    window.open(downloadUrl, '_blank', 'noopener,noreferrer');
  }

  async function downloadFile(blobName, fileName = 'archivo') {
    const { downloadUrl } = await getReadSas(blobName);
    const res = await fetch(downloadUrl);
    if (!res.ok) throw new Error('No se pudo descargar');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  return { getUploadSas, getUploadSasCustom, getUploadSasProvider, putToAzure, getReadSas, listByPrefix, uploadFilesWithSas, uploadFilesWithSasCustom, uploadProviderDocument, openFile, downloadFile };
}

