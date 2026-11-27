import { forwardRef } from 'react';
const Link = forwardRef<HTMLAnchorElement, any>(({ href, prefetch, replace, scroll, shallow, legacyBehavior, passHref, onClick, ...rest }, ref) => {
  const to = typeof href === 'string' ? href : (href?.pathname ?? '') + (href?.query ? '?' + new URLSearchParams(href.query) : '');
  return <a ref={ref} href={to} onClick={(e) => { onClick?.(e); e.preventDefault(); }} {...rest} />;
});
export default Link;
