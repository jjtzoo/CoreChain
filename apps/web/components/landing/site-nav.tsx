import Image from "next/image";
import Link from "next/link";
import { nav } from "./content";
import { MobileMenu } from "./mobile-menu";

export function SiteNav() {
  return (
    <header className="lp-header">
      <div className="lp-wrap lp-bar">
        <Link href="/" aria-label="CoreChain home">
          <Image
            className="lp-logo"
            src="/branding/corechain-primary-horizontal.svg"
            alt="CoreChain"
            width={150}
            height={42}
            priority
          />
        </Link>
        <nav className="lp-nav" aria-label="Main">
          {nav.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="lp-bar-actions">
          <Link className="lp-btn lp-btn-line lp-btn-small" href="/login">
            Sign in
          </Link>
          <a className="lp-btn lp-btn-solid lp-btn-small lp-hide-small" href="#access">
            Request pilot access
          </a>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
