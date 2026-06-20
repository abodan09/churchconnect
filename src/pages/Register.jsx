import { SignUp } from '@clerk/clerk-react';

export default function Register() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary/40 to-background flex items-center justify-center p-4">
      <SignUp
        routing="path"
        path="/register"
        afterSignUpUrl="/setup"
        appearance={{
          elements: {
            rootBox: 'w-full max-w-md',
            card: 'rounded-2xl shadow-lg border border-border',
          },
        }}
      />
    </div>
  );
}
