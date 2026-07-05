import { redirect } from "next/navigation";

// The bare marketing splash never had a real screen behind it - no QR
// scanner, no code entry, nothing to click. /gallery-entry is the real,
// wired entry point (Stitch "Gallery Entry" screen), so send visitors
// straight there instead of a dead end.
export default function Home() {
  redirect("/gallery-entry");
}
