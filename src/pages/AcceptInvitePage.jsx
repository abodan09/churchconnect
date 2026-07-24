import { SignUp } from "@clerk/clerk-react";

// Invited users land here from the email link with a `__clerk_ticket` in the URL.
// Clerk's <SignUp> detects the ticket automatically: it pre-fills + locks the
// email and skips email verification (the invitation already proves ownership).
// Their church_id + role travel in the invitation's publicMetadata and are
// provisioned into a UserProfile on first load of /api/me.
export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Welcome to ChurchConnect</h1>
        <p className="text-muted-foreground text-sm mt-1">Set your password to finish joining your church.</p>
      </div>
      <SignUp signUpUrl="/accept-invite" signInUrl="/login" fallbackRedirectUrl="/" />
    </div>
  );
}
