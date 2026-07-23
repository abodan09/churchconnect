import LegalPageLayout from "@/components/LegalPageLayout";

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="23 July 2026">
      <p>
        This Privacy Policy explains how FrozenBit (“we”, “us”, or “our”) handles personal data in
        connection with ChurchConnect (the “Service”). We are committed to protecting the privacy of
        the churches that use the Service and the individuals whose information they store.
      </p>

      <h2>1. Controller and Processor Roles</h2>
      <p>
        For the account information of the administrators who sign up, FrozenBit acts as the data
        controller. For the information a church enters about its members and other individuals
        (“Church Data”), the church is the data controller and FrozenBit acts as a processor,
        handling that data only on the church’s documented instructions to provide the Service.
      </p>

      <h2>2. Information We Collect</h2>
      <h3>Account information</h3>
      <ul>
        <li>Name, email address, and password credentials (managed by our authentication provider);</li>
        <li>Your role and the church/organization you are associated with;</li>
        <li>Basic profile details you choose to add.</li>
      </ul>
      <h3>Church Data entered by administrators</h3>
      <ul>
        <li>Member details (such as name, contact details, address and address history, date of birth, family relationships, department, and membership status);</li>
        <li>Giving and financial records (tithes, offerings, welfare, expenditures) and generated statements;</li>
        <li>Attendance, events, sermons, small groups, pastoral-care notes, volunteers, and announcements.</li>
      </ul>
      <h3>Technical information</h3>
      <ul>
        <li>Log and diagnostic data such as approximate location (IP address), device/browser type, and timestamps, used to operate and secure the Service.</li>
      </ul>

      <h2>3. How We Use Information</h2>
      <ul>
        <li>To provide, maintain, and improve the Service;</li>
        <li>To authenticate users and secure accounts;</li>
        <li>To process subscriptions and payments where applicable;</li>
        <li>To provide support and respond to your requests;</li>
        <li>To detect, prevent, and address abuse, fraud, and security incidents;</li>
        <li>To comply with legal obligations.</li>
      </ul>
      <p>
        We do not sell your personal data, and we do not use Church Data to build advertising
        profiles.
      </p>

      <h2>4. Offline (Standalone) Mode</h2>
      <p>
        When you use the standalone desktop application in offline mode, your Church Data is stored
        locally on your own device and is not transmitted to our servers. The one exception is the
        first-time activation, during which the desktop app verifies your existing account
        credentials with our cloud once; after activation it operates offline. Securing the device
        on which offline data is stored is your responsibility.
      </p>

      <h2>5. Service Providers (Sub-processors)</h2>
      <p>
        We use trusted third parties to run the Service. Each processes data only as needed to
        provide their function:
      </p>
      <ul>
        <li><strong>Clerk</strong> — user authentication and subscription/billing management;</li>
        <li><strong>Vercel</strong> — application hosting and delivery;</li>
        <li><strong>Neon</strong> — managed PostgreSQL database hosting for cloud data;</li>
        <li><strong>Vercel Blob</strong> — storage of uploaded files and images;</li>
        <li><strong>Resend</strong> — delivery of transactional and report emails you send;</li>
        <li><strong>Anthropic</strong> — processing prompts submitted to AI-assisted features;</li>
        <li>A payment processor engaged through our billing provider, for paid subscriptions.</li>
      </ul>

      <h2>6. International Transfers</h2>
      <p>
        The Service is primarily hosted in the European Union. Where a provider processes data
        outside your country, we rely on appropriate safeguards (such as standard contractual
        clauses) where required by law.
      </p>

      <h2>7. Data Retention</h2>
      <p>
        We retain account and Church Data for as long as your account is active or as needed to
        provide the Service. A church may delete records within the Service at any time. On account
        closure, we delete or anonymize personal data within a reasonable period, unless we are
        required to retain it to comply with legal obligations. Offline data remains on your device
        until you remove it.
      </p>

      <h2>8. Your Rights</h2>
      <p>
        Depending on your location (including under the EU/UK GDPR), you may have the right to
        access, correct, delete, restrict, or object to the processing of your personal data, and to
        data portability. Because a church is the controller of its members’ data, requests from a
        member should generally be directed to their church; we will assist the church in responding.
        For account information we control, you can contact us using the details below.
      </p>

      <h2>9. Children’s Data</h2>
      <p>
        Churches may store information about minors (for example, children in a family record). Where
        a church does so, it is responsible for having the appropriate legal basis and any required
        parental consent. We process such data only on the church’s behalf to provide the Service.
      </p>

      <h2>10. Cookies and Local Storage</h2>
      <p>
        We use cookies and local storage that are necessary to keep you signed in and to operate the
        Service. We do not use them for third-party advertising.
      </p>

      <h2>11. Security</h2>
      <p>
        We use technical and organizational measures to protect personal data, including encrypted
        connections, access controls, and hashed credentials. No system is perfectly secure, so we
        cannot guarantee absolute security, and you play an important role by protecting your
        credentials and devices.
      </p>

      <h2>12. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will revise the “Last updated” date
        above and, for material changes, provide additional notice where appropriate.
      </p>

      <h2>13. Contact</h2>
      <p>
        For privacy questions or to exercise your rights, contact us at{" "}
        <a href="mailto:admin@frozenbit.eu">admin@frozenbit.eu</a>.
      </p>
    </LegalPageLayout>
  );
}
