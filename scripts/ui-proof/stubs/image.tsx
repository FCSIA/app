import { forwardRef } from 'react';
const Image = forwardRef<HTMLImageElement, any>(({ src, fill, priority, quality, placeholder, blurDataURL, unoptimized, loader, style, ...rest }, ref) =>
  <img ref={ref} src={typeof src === 'string' ? src : src?.src} style={fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%', ...style } : style} {...rest} />);
export default Image;
