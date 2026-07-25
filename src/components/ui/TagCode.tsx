import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { QRCodeSVG } from 'qrcode.react';

// Real, scannable barcode/QR rendering for a physical Tag (Milestone 5), replacing the
// decorative lucide-react Barcode icon previously used in CatalogManager and JobBagManager.

export function TagBarcode({ value, height = 40, className = '' }: { value: string; height?: number; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (ref.current && value) {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        displayValue: false,
        height,
        width: 1.4,
        margin: 0,
      });
    }
  }, [value, height]);

  return <svg ref={ref} className={className} />;
}

export function TagQRCode({ value, size = 64 }: { value: string; size?: number }) {
  return <QRCodeSVG value={value} size={size} level="M" marginSize={0} />;
}
