"use client";

import { useRef } from "react";
import { nav } from "./content";

/** The section links on a phone. A native disclosure, closed again once a
 * link is chosen so it doesn't cover the section it jumped to. */
export function MobileMenu() {
  const menu = useRef<HTMLDetailsElement>(null);
  const close = () => {
    if (menu.current) menu.current.open = false;
  };
  return (
    <details className="lp-menu" ref={menu}>
      <summary aria-label="Sections">Menu</summary>
      <nav className="lp-menu-panel" aria-label="Sections">
        {nav.map((item) => (
          <a key={item.href} href={item.href} onClick={close}>
            {item.label}
          </a>
        ))}
        <a href="#access" onClick={close} className="lp-menu-cta">
          Request pilot access
        </a>
      </nav>
    </details>
  );
}
