import Image from "next/image";

// A photographer's studio logo (currently Photo Santos, the only studio in
// the app so far). Distinct asset from OuraLogo, shown in different places:
// the photographer's own dashboard identity, watermarks on guest photos, and
// gallery footer/photo credits - never paired with the Oura wordmark as its
// label, so the two brands stay unambiguous (per the brand separation rule).
// Later this becomes per-studio (the actual thing Branding Settings' logo
// upload manages) rather than a single hardcoded asset.
export function StudioLogo({
  variant = "icon",
  size = 32,
  className = "",
}: {
  variant?: "icon" | "lockup";
  size?: number;
  className?: string;
}) {
  const src =
    variant === "lockup"
      ? "/brand/photo-santos-lockup.png"
      : "/brand/photo-santos-icon.png";
  return (
    <Image
      src={src}
      alt="Photo Santos"
      width={size}
      height={size}
      className={`object-contain ${className}`}
    />
  );
}
