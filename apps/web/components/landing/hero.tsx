import type { Route } from "next";
import Link from "next/link";
import { hero, SAMPLE_PROJECT_HREF } from "./content";
import { PhoneShot } from "./phone-shot";

export function Hero() {
  return (
    <div className="lp-wrap lp-hero">
      <div className="lp-hero-copy">
        <p className="lp-kicker">{hero.kicker}</p>
        <h1>{hero.title}</h1>
        <p className="lp-lede">{hero.lede}</p>
        <div className="lp-cta">
          <a className="lp-btn lp-btn-solid" href="#access">
            {hero.primary}
          </a>
          <Link
            className="lp-btn lp-btn-line"
            href={SAMPLE_PROJECT_HREF as Route}
          >
            {hero.secondary}
          </Link>
        </div>
        <p className="lp-hero-note">{hero.secondaryNote}</p>
        <p className="lp-hero-status">
          <i aria-hidden="true" />
          {hero.status}
        </p>
      </div>

      <figure className="lp-hero-visual">
        <div className="lp-hero-stage">
          <div className="lp-webcard">
            <div className="lp-webcard-bar" aria-hidden="true">
              <span />
              <span />
              <span />
              <b>Team · Holes</b>
            </div>
            <div className="lp-webcard-body">
              <div className="lp-webcard-head">
                <div>
                  <p className="lp-webcard-id">{hero.web.title}</p>
                  <p className="lp-webcard-sub">{hero.web.sub}</p>
                </div>
                <span className="lp-badge lp-badge-ok">{hero.web.badge}</span>
              </div>
              <dl className="lp-webcard-stats">
                {hero.web.stats.map((stat) => (
                  <div key={stat.label}>
                    <dt>{stat.label}</dt>
                    <dd>
                      <b>{stat.value}</b>
                      <span>{stat.note}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="lp-webcard-foot">{hero.web.synced}</p>
            </div>
          </div>
          <PhoneShot
            className="lp-hero-phone"
            src="/landing/field-drillhole.png"
            alt={hero.phoneAlt}
            width={720}
            height={1282}
            priority
          />
        </div>
        <figcaption>{hero.caption}</figcaption>
      </figure>
    </div>
  );
}
