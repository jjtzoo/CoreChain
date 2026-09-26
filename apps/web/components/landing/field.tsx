import Image from "next/image";
import { field } from "./content";
import { PhoneShot } from "./phone-shot";

export function Field() {
  return (
    <section id="field" className="lp-section">
      <div className="lp-wrap">
        <div className="lp-head">
          <p className="lp-eyebrow">CoreChain Field · Android</p>
          <h2>{field.title}</h2>
          <p>{field.intro}</p>
        </div>
        <div className="lp-shots">
          {field.shots.map((shot) => (
            <figure className="lp-shot" key={shot.src}>
              <PhoneShot
                src={shot.src}
                alt={shot.alt}
                width={shot.width}
                height={shot.height}
              />
              <figcaption>
                <h3>{shot.title}</h3>
                <p>{shot.text}</p>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="lp-offline">
          <div className="lp-offline-shot">
            <Image
              src={field.offline.src}
              alt={field.offline.alt}
              width={field.offline.width}
              height={field.offline.height}
              sizes="(max-width: 900px) 90vw, 420px"
            />
          </div>
          <div>
            <h3>{field.offline.title}</h3>
            <p>{field.offline.text}</p>
            <div className="lp-points">
              {field.points.map((point) => (
                <div key={point.title}>
                  <h4>{point.title}</h4>
                  <p>{point.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
