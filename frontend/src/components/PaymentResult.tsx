import { useSearchParams } from "react-router-dom";

export default function PaymentResult() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status");
  const plan = searchParams.get("plan");

  return (
    <div className="max-w-lg mx-auto py-20 px-4 text-center">
      {status === "success" ? (
        <>
          <h1 className="text-3xl font-bold text-green-600 mb-4">Payment Successful!</h1>
          <p className="text-lg mb-6">Your plan has been updated to <span className="font-semibold text-indigo-700">{plan}</span>.</p>
          <a href="/plans" className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Go to Plan Management</a>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-bold text-red-600 mb-4">Payment Failed</h1>
          <p className="text-lg mb-6">There was an issue processing your payment. Please try again or contact support.</p>
          <a href="/plans" className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Back to Plans</a>
        </>
      )}
    </div>
  );
}
