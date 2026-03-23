import { DocsContent } from "@/components/docs-content";
import { DocsSidebar } from "@/components/docs-sidebar";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";

export default function DocsPage() {
  return (
    <>
      <Navbar />
      <div className="mx-auto flex max-w-7xl pt-14">
        <DocsSidebar />
        <main className="min-w-0 flex-1 px-6 py-12 md:px-12">
          <DocsContent />
        </main>
      </div>
      <Footer />
    </>
  );
}
