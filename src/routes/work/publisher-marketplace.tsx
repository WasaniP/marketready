/**
 * Case study: Enterprise Publisher Marketplace (CASE 01 / 04).
 * Thin wrapper over the shared WorkCasePage blueprint.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Header, Footer } from "~/components/Layout";
import { BookingModal } from "~/components/BookingModal";
import { WorkCasePage } from "~/components/work-case";
import { WORK_CASES } from "~/lib/work/cases";

const DATA = WORK_CASES[0];

export const Route = createFileRoute("/work/publisher-marketplace")({
  head: () => ({
    meta: [
      { title: DATA.pageTitle },
      { name: "description", content: DATA.pageDescription },
    ],
  }),
  component: PublisherMarketplacePage,
});

function PublisherMarketplacePage() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [preselectService, setPreselectService] = useState<string | undefined>(
    undefined,
  );
  const openBooking = (service?: string) => {
    setPreselectService(service);
    setBookingOpen(true);
  };
  const closeBooking = () => setBookingOpen(false);
  return (
    <div className="min-h-dvh bg-[#F2ECE2]">
      <Header />
      <main>
        <WorkCasePage data={DATA} />
      </main>
      <Footer onBook={() => openBooking()} />
      {bookingOpen && (
        <BookingModal
          open={bookingOpen}
          onClose={closeBooking}
          initialService={preselectService}
        />
      )}
    </div>
  );
}
