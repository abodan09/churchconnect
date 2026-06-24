import { PricingTable } from '@clerk/clerk-react';

export default function PricingPage() {
  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold mb-2">Choose your plan</h1>
        <p className="text-muted-foreground">
          Upgrade to unlock advanced features for your church.
        </p>
      </div>
      <PricingTable for="organization" />
    </div>
  );
}
