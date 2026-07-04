import Image from "next/image";

// The Oura platform mark. Two variants of one source asset:
//  - icon: just the shutter/rose mark, for compact square badges (headers,
//    nav bars) - this is what every "O" placeholder box gets replaced with.
//  - lockup: icon + "Oura" wordmark stacked, for larger hero placements.
// Per brand separation rule: never set a photographer's studio name as the
// adjacent label for this logo - it always reads as "Oura" (see StudioLogo
// for the other brand).
export function OuraLogo({
  variant = "icon",
  size = 40,
  className = "",
}: {
  variant?: "icon" | "lockup";
  size?: number;
  className?: string;
}) {
  const src = variant === "lockup" ? "/brand/oura-lockup.png" : "/brand/oura-icon.png";
  return (
    <Image
      src={src}
      alt="Oura"
      width={size}
      height={size}
      className={`object-contain ${className}`}
      priority
    />
  );
}
