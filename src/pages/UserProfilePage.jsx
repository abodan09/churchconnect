import { UserProfile } from '@clerk/clerk-react';

export default function UserProfilePage() {
  return (
    <div className="flex justify-center py-4">
      <UserProfile routing="hash" />
    </div>
  );
}
