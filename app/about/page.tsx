import { Reveal } from "@/components/home/reveal";
import { About } from "@/components/about/about";
import { ContactForm } from "@/components/about/contact-form";

export default function AboutPage() {
  return (
    <div className="about fade-in">
      <Reveal />
      <About />
      <ContactForm />
    </div>
  );
}
