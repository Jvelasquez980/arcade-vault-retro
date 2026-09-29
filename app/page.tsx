import { Reveal } from "@/components/home/reveal";
import { Hero } from "@/components/home/hero";
import { Features } from "@/components/home/features";
import { GamesPreview } from "@/components/home/games-preview";
import { Stats } from "@/components/home/stats";
import { Activity } from "@/components/home/activity";
import { Pricing } from "@/components/home/pricing";
import { FinalCta } from "@/components/home/final-cta";

export default function Home() {
  return (
    <div className="home fade-in">
      <Reveal />
      <Hero />
      <Features />
      <GamesPreview />
      <Stats />
      <Activity />
      <Pricing />
      <FinalCta />
    </div>
  );
}
