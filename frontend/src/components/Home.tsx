import { useState, useEffect } from "react";
import { useSocket } from "../context/SocketContext";

export default function Home() {
  console.log("Rendering Home component");

  return (
    <>
      {/* Navbar */}

      <main className="main-content">
        {/* Hero */}
        <section id="home" className="bg-gray-50 dark:bg-gray-900 py-20">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white mb-6">
              Transform Your File Management Experience
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8">
              Professional file management, image transformation, and analytics
              platform with real-time insights and seamless integrations.
            </p>
            <div className="flex justify-center gap-4">
              <a
                href="/register"
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md"
              >
                Get Started Free
              </a>
              <a
                href="#plans"
                className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                View Plans
              </a>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
              Powerful Features
            </h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: "📁",
                  title: "File Management",
                  desc: "Upload, organize, and manage files with advanced search and filtering capabilities.",
                },
                {
                  icon: "🔄",
                  title: "Image Transformation",
                  desc: "Real-time image processing and transformation with multiple format support.",
                },
                {
                  icon: "📊",
                  title: "Advanced Analytics",
                  desc: "Comprehensive insights with real-time metrics and usage statistics.",
                },
                {
                  icon: "🔒",
                  title: "Enterprise Security",
                  desc: "JWT authentication, secure file storage, and advanced access controls.",
                },
              ].map((f, i) => (
                <div
                  key={i}
                  className="p-6 rounded-xl shadow-md bg-gray-50 dark:bg-gray-800"
                >
                  <div className="text-4xl mb-3">{f.icon}</div>
                  <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
                  <p className="text-gray-600 dark:text-gray-300">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Login */}
    

        {/* Register */}
       

        {/* Dashboard */}
        <section id="dashboard" className="py-16 bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-6">
            <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: "📊", title: "API Calls", value: "0 / 1000" },
                { icon: "💾", title: "Storage", value: "0 / 1GB" },
                { icon: "📁", title: "Files", value: "0" },
                { icon: "💰", title: "Plan", value: "Free" },
              ].map((s, i) => (
                <div
                  key={i}
                  className="p-6 rounded-xl shadow-md bg-gray-50 dark:bg-gray-800"
                >
                  <div className="text-3xl">{s.icon}</div>
                  <h3 className="font-semibold mt-2">{s.title}</h3>
                  <p className="text-lg">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Files */}
        <section id="files" className="py-16 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-6">
            <h1 className="text-3xl font-bold mb-6">File Management</h1>
            <div className="flex gap-4 mb-6">
              <input
                type="text"
                placeholder="Search files..."
                className="flex-1 border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <select className="border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600">
                <option>All Files</option>
                <option>Images</option>
                <option>Documents</option>
                <option>Videos</option>
              </select>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg dark:border-gray-700 dark:bg-gray-800">
                <div className="text-2xl">📄</div>
                <h4 className="font-semibold">example.pdf</h4>
                <p className="text-sm text-gray-500">2.3 MB • 2 days ago</p>
                <div className="flex gap-2 mt-2">
                  <button className="px-2 py-1 border rounded-md text-sm">
                    Download
                  </button>
                  <button className="px-2 py-1 border rounded-md text-sm">
                    Transform
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Plans */}
        <section id="plans" className="py-16 bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <h1 className="text-3xl font-bold mb-6">Choose Your Plan</h1>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  name: "Free",
                  price: "$0",
                  features: ["1GB Storage", "1000 API calls", "Basic upload"],
                },
                {
                  name: "Basic",
                  price: "$10",
                  features: [
                    "5GB Storage",
                    "5000 API calls",
                    "Analytics",
                    "Email support",
                  ],
                },
                {
                  name: "Premium",
                  price: "$20",
                  features: [
                    "10GB Storage",
                    "10,000 API calls",
                    "Priority support",
                  ],
                },
              ].map((p, i) => (
                <div
                  key={i}
                  className="p-6 border rounded-xl shadow-md dark:border-gray-700 dark:bg-gray-800"
                >
                  <h3 className="text-xl font-semibold">{p.name}</h3>
                  <p className="text-2xl font-bold mt-2">{p.price}/mo</p>
                  <ul className="mt-4 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                    {p.features.map((f, j) => (
                      <li key={j}>{f}</li>
                    ))}
                  </ul>
                  <button className="mt-6 w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                    {i === 0 ? "Current Plan" : "Upgrade"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Admin */}
        <section id="admin" className="py-16 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-6">
            <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="p-6 rounded-xl bg-white dark:bg-gray-800 shadow-md">
                <h3 className="font-semibold mb-2">User Management</h3>
                <p>Total Users: 0</p>
                <p>Active Today: 0</p>
                <button className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                  Seed Users
                </button>
              </div>
              <div className="p-6 rounded-xl bg-white dark:bg-gray-800 shadow-md">
                <h3 className="font-semibold mb-2">Payment Overview</h3>
                <p>Monthly Revenue: $0</p>
                <p>Transactions: 0</p>
              </div>
            </div>
          </div>
        </section>

        {/* Settings */}
        <section id="settings" className="py-16 bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-6">
            <h1 className="text-3xl font-bold mb-6">Account Settings</h1>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg shadow">
                <h3 className="font-semibold mb-4">Profile</h3>
                <input
                  type="text"
                  placeholder="Name"
                  className="w-full mb-3 border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <input
                  type="email"
                  placeholder="Email"
                  className="w-full mb-3 border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <button className="w-full py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                  Save
                </button>
              </div>
              <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg shadow">
                <h3 className="font-semibold mb-4">Security</h3>
                <input
                  type="password"
                  placeholder="Current Password"
                  className="w-full mb-3 border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <input
                  type="password"
                  placeholder="New Password"
                  className="w-full mb-3 border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <button className="w-full py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                  Update Password
                </button>
                <label className="flex items-center gap-2 mt-3 text-sm">
                  <input type="checkbox" />
                  Enable Two-Factor Auth
                </label>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Upload Modal */}
      <div className="fixed inset-0 bg-black/50 hidden items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Upload Files</h3>
            <button className="text-xl">&times;</button>
          </div>
          <div className="border-2 border-dashed p-6 text-center rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
            <div className="text-3xl">📁</div>
            <p>Drag & drop or click to browse</p>
          </div>
        </div>
      </div>

      {/* Toasts */}
      <div className="fixed top-4 right-4 space-y-2 z-50"></div>

      {/* Loading Overlay */}
      <div className="fixed inset-0 bg-black/40 hidden items-center justify-center z-50">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    </>
  );
}
