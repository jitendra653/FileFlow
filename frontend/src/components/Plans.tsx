import { useState, useEffect } from "react";
import API_BASE_URL from '../utils/apiConfig';
import React from 'react'

export default function Plans() {

const plans = [
  {
    name: "Free",
    price: 0,
    features: ["1GB Storage", "1,000 API calls/month", "Basic file upload", "Standard support"],
  },
  {
    name: "Basic",
    price: 10,
    features: ["5GB Storage", "5,000 API calls/month", "Enhanced file management", "Analytics dashboard", "Email support"],
  },
  {
    name: "Premium",
    price: 20,
    features: ["10GB Storage", "10,000 API calls/month", "Advanced transformations", "Priority support", "Admin panel", "Custom integrations"],
  },
];

  const [selectedPlan, setSelectedPlan] = useState("Free");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentPlan, setCurrentPlan] = useState("Free");
  const [quota, setQuota] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState("");

  useEffect(() => {
    // Fetch current plan and quota
    const fetchUser = async () => {
      try {
  const res = await fetch(`${API_BASE_URL}/v1/profile/me`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("authToken")}` }
        });
        const data = await res.json();
        setCurrentPlan(data.plan);
        setSelectedPlan(data.plan);
        setQuota(data.quota);
      } catch (err) {
        // fallback
      }
    };
    // Fetch payment history
    const fetchPayments = async () => {
      try {
  const res = await fetch(`${API_BASE_URL}/v1/plan/payments`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("authToken")}` }
        });
        const data = await res.json();
        setPaymentHistory(data.payments || []);
      } catch (err) {}
    };
    fetchUser();
    fetchPayments();
  }, []);

  const handlePlanChange = async (planName: string) => {
    setSelectedPlan(planName);
    if (planName === currentPlan) return;
    if (planName === "Free") {
      // Downgrade to free, no payment
      setLoading(true);
      setError("");
      try {
  const res = await fetch(`${API_BASE_URL}/v1/plan/downgrade`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("authToken")}`,
          },
          body: JSON.stringify({ plan: "free" }),
        });
        const data = await res.json();
        if (data.success) {
          setCurrentPlan("Free");
          setQuota(data.quota);
        } else {
          setError(data.error || "Failed to downgrade plan.");
        }
      } catch (err) {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    setError("");
    try {
  const res = await fetch(`${API_BASE_URL}/v1/plan/create-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({ plan: planName.toLowerCase() }),
      });
      const data = await res.json();
      if (data.approvalUrl) {
        window.location.href = data.approvalUrl;
      } else {
        setError(data.error || "Failed to initiate payment.");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPlan = async () => {
    setCancelLoading(true);
    setCancelError("");
    try {
  const res = await fetch(`${API_BASE_URL}/v1/plan/cancel`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("authToken")}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setCurrentPlan("Free");
        setQuota(data.quota);
      } else {
        setCancelError(data.error || "Failed to cancel plan.");
      }
    } catch (err) {
      setCancelError("Network error. Please try again.");
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6">Manage Your Plan</h1>
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <span className="font-semibold">Current Plan:</span>
          <span className="px-3 py-1 rounded bg-indigo-100 text-indigo-700 font-bold">{currentPlan}</span>
          {currentPlan !== "Free" && (
            <button
              className="ml-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              onClick={handleCancelPlan}
              disabled={cancelLoading}
            >
              Cancel Plan
            </button>
          )}
        </div>
        {cancelError && <div className="text-red-600 mt-2">{cancelError}</div>}
      </div>
      {quota && (
        <div className="mb-8 grid grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-2">Storage Usage</h3>
            <div className="mb-1">{(quota.storageUsed / (1024*1024)).toFixed(2)} MB / {(quota.storageLimit / (1024*1024)).toFixed(2)} MB</div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full"
                style={{ width: `${(quota.storageUsed / quota.storageLimit) * 100}%` }}
              ></div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-2">API Usage</h3>
            <div className="mb-1">{quota.apiCallsMade} / {quota.apiCallLimit} calls</div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-green-600 h-2.5 rounded-full"
                style={{ width: `${(quota.apiCallsMade / quota.apiCallLimit) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-6 mb-8">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`border rounded-lg p-6 shadow-md ${selectedPlan === plan.name ? "border-indigo-600" : "border-gray-300"}`}
          >
            <h2 className="text-xl font-semibold mb-2">{plan.name}</h2>
            <p className="text-lg font-bold mb-2">${plan.price}/month</p>
            <ul className="mb-4 text-sm text-gray-600">
              {plan.features.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
            <button
              className={`w-full py-2 rounded ${selectedPlan === plan.name ? "bg-indigo-600 text-white" : "bg-gray-100"}`}
              onClick={() => handlePlanChange(plan.name)}
              disabled={selectedPlan === plan.name || loading}
            >
              {selectedPlan === plan.name ? "Current Plan" : plan.price > plans.find(p => p.name === currentPlan)?.price ? "Upgrade" : "Downgrade"}
            </button>
          </div>
        ))}
      </div>
      {error && <div className="text-red-600 mb-4">{error}</div>}
      {loading && <div className="text-gray-600 mb-4">Processing payment...</div>}
      <div className="bg-white rounded-lg shadow p-6 mt-8">
        <h2 className="text-lg font-semibold mb-4">How payments work</h2>
        <p className="text-gray-700 mb-2">Upgrading or downgrading your plan will redirect you to PayPal for secure payment. Your plan and quota will update automatically after payment is completed.</p>
        <p className="text-gray-700">No card details are stored on this platform. All payments are processed by PayPal.</p>
      </div>
      <div className="bg-white rounded-lg shadow p-6 mt-8">
        <h2 className="text-lg font-semibold mb-4">Payment History</h2>
        {paymentHistory.length === 0 ? (
          <div className="text-gray-600">No payments found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Plan</th>
                <th className="text-left py-2">Amount</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {paymentHistory.map((p, i) => (
                <tr key={i} className="border-t">
                  <td>{new Date(p.createdAt).toLocaleString()}</td>
                  <td>{p.plan}</td>
                  <td>${p.amount}</td>
                  <td>{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

}

