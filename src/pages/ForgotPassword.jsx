import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ForgotPassword() {
  return (
    <AuthLayout
      icon={Mail}
      title="Reset password"
      subtitle="Use the login page to reset your password"
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline">
          ← Back to log in
        </Link>
      }
    >
      <p className="text-sm text-foreground text-center">
        Click "Forgot password?" on the login page — Clerk will send you a
        secure reset link to your email address.
      </p>
    </AuthLayout>
  );
}
