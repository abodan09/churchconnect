import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ResetPassword() {
  return (
    <AuthLayout
      icon={Lock}
      title="Reset password"
      subtitle="Follow the link in your email to set a new password"
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline">
          ← Back to log in
        </Link>
      }
    >
      <p className="text-sm text-foreground text-center">
        Password resets are handled by Clerk. If you followed a reset link and
        landed here, please go back to the login page and use "Forgot password?"
        to request a fresh link.
      </p>
    </AuthLayout>
  );
}
