export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <span className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
        Oura
      </span>
      <h1 className="text-4xl font-bold text-on-background sm:text-5xl">
        הרגעים שלכם, כאן ועכשיו
      </h1>
      <p className="max-w-md text-base text-on-surface-variant">
        פלטפורמת AI לצלמי אירועים. גלריה חיה, מזוהה פנים, וממותגת, ישירות
        לנייד של האורחים.
      </p>
    </main>
  );
}
