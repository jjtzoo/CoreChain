import Image from "next/image";

/** A real CoreChain Field screenshot in a plain phone outline. */
export function PhoneShot({
  src,
  alt,
  width,
  height,
  priority = false,
  className,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={`lp-phone${className ? ` ${className}` : ""}`}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        sizes="(max-width: 600px) 72vw, 300px"
      />
    </div>
  );
}
