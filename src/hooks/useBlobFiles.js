import { useEffect, useState } from 'react';

// prefixParam: string | string[]
export function useBlobFiles(blobClient, prefixParam) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!prefixParam || !blobClient) return;
      setLoading(true);
      setError('');
      try {
        const prefixes = Array.isArray(prefixParam) ? prefixParam : [prefixParam];
        let collected = [];
        let lastErr = '';
        for (const p of prefixes) {
          try {
            const items = await blobClient.listByPrefix(p);
            if (items && items.length > 0) {
              collected = items;
              break;
            } else {
              collected = items || [];
            }
          } catch (e) {
            lastErr = e?.message || String(e);
          }
        }
        if (mounted) {
          setFiles(collected);
          setError(lastErr || '');
        }
      } catch (e) {
        if (mounted) {
          setError(e.message || 'Error');
          setFiles([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [blobClient, prefixParam]);

  const refresh = async () => {
    if (!prefixParam || !blobClient) return;
    const prefixes = Array.isArray(prefixParam) ? prefixParam : [prefixParam];
    for (const p of prefixes) {
      const items = await blobClient.listByPrefix(p);
      if (items && items.length > 0) {
        setFiles(items);
        return;
      }
    }
    setFiles([]);
  };

  return { files, loading, error, refresh };
}

