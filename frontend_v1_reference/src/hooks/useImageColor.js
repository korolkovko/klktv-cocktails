import { useEffect, useRef, useState } from 'react';

export function useImageColor(src) {
  const [color, setColor] = useState(null);
  const imgRef = useRef(null);

  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;

    const extract = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        const pixel = ctx.getImageData(5, 5, 1, 1).data;
        setColor(`rgb(${pixel[0]},${pixel[1]},${pixel[2]})`);
      } catch {
        setColor('rgb(17,17,17)');
      }
    };

    if (img.complete) extract();
    else img.onload = extract;
    img.onerror = () => setColor('rgb(17,17,17)');

    imgRef.current = img;
    return () => { img.onload = null; img.onerror = null; };
  }, [src]);

  return color;
}
