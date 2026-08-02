import { useEffect, useState } from 'react';
import { connectMainIpcTransport } from 'tbf/shell';
import { ipc } from '../../shared/ipc.js';
import type { Product } from '../types.js';

const fallback: Product = {
  name: 'Scout',
  home: 'https://example.com/',
};

export function useProduct(
  report: (reason: unknown) => void,
): Product {
  const [product, setProduct] = useState(fallback);

  useEffect(() => {
    let close: undefined | (() => void);
    void connectMainIpcTransport().then(async (transport) => {
      close = () => transport.close();
      setProduct(await ipc.bind(transport).invoke('getProduct', undefined));
    }).catch(report);
    return () => close?.();
  }, [report]);

  return product;
}
