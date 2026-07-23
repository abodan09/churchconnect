import { useEffect, useState } from "react";
import LegalPageLayout from "@/components/LegalPageLayout";

export default function AboutPage() {
  const [version, setVersion] = useState("");

  useEffect(() => {
    window.electronAPI?.getVersion?.().then(setVersion).catch(() => {});
  }, []);

  return (
    <LegalPageLayout title="About ChurchConnect" lastUpdated="24 July 2026">
      <p>
        ChurchConnect is a church management platform that helps churches look after their people
        and their administration in one place — members and families, giving and expenditures,
        events and attendance, departments and small groups, pastoral care, and communications. It
        runs both as a cloud application and as a standalone desktop app that works fully offline.
      </p>

      <h2>Who builds ChurchConnect</h2>
      <p>
        ChurchConnect is designed &amp; built by <strong>SoftBit</strong>, the software-development
        arm of <strong>FrozenBit</strong>.
      </p>

      <h3>FrozenBit</h3>
      <p>
        FrozenBit is an emerging, multi-industry group and the parent company under which our
        ventures operate. Its mission is to build practical, dependable products for real-world
        communities and businesses.
      </p>

      <h3>SoftBit</h3>
      <p>
        SoftBit is FrozenBit’s software-development subsidiary. It designs and builds FrozenBit’s
        digital products — including ChurchConnect — with a focus on reliability, privacy, and tools
        that work even when the internet doesn’t.
      </p>

      <h2>Contact</h2>
      <p>
        We’d love to hear from you — reach us at{" "}
        <a href="mailto:admin@frozenbit.eu">admin@frozenbit.eu</a>. See also our{" "}
        <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>.
      </p>

      {version && <p className="text-xs">App version {version}</p>}
    </LegalPageLayout>
  );
}
