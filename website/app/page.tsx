import { Features } from "@/components/features";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { InstallSection } from "@/components/install-section";
import { Navbar } from "@/components/navbar";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "envsec",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "macOS, Linux, Windows",
  description:
    "Cross-platform CLI for managing environment secrets using native OS credential stores. Secrets never touch disk.",
  url: "https://envsec.dev",
  downloadUrl: "https://www.npmjs.com/package/envsec",
  license: "https://opensource.org/licenses/MIT",
  author: {
    "@type": "Person",
    name: "David Nussio",
    url: "https://github.com/davidnussio",
  },
  codeRepository: "https://github.com/davidnussio/envsec",
  programmingLanguage: "TypeScript",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function Home() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        type="application/ld+json"
      />
      <Navbar />
      <main className="px-6 py-12 md:px-12">
        <Hero />
        <Features />
        <HowItWorks />
        <InstallSection />
      </main>
      <Footer />
    </>
  );
}
