import React from 'react'

export default function Navbar() {
  return ( <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand */}
            <div className="flex items-center gap-2 text-xl font-bold text-indigo-600 dark:text-indigo-400">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>RDX Project</span>
            </div>

            {/* Menu */}
            <div className="hidden md:flex space-x-6 text-gray-600 dark:text-gray-300">
              <a href="/dashboard" className="hover:text-indigo-500">
                Dashboard
              </a>
              <a href="/files" className="hover:text-indigo-500">
                Files
              </a>
              <a href="#plans" className="hover:text-indigo-500">
                Plans
              </a>
              <a href="#admin" className="hover:text-indigo-500">
                Admin
              </a>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-3">
              {/* Theme toggle */}
              <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                <svg
                  className="w-5 h-5 text-gray-700 dark:text-gray-200"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 3v1m0 16v1m9-9h-1M4 12H3..." />
                </svg>
              </button>

   

              {/* Auth */}
              <div className="flex space-x-2">
                <a
                  href="/login"
                  className="px-3 py-1 border border-indigo-500 text-indigo-500 rounded-md hover:bg-indigo-50 text-sm"
                >
                  Login
                </a>
                <a
                  href="/register"
                  className="px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
                >
                  Register
                </a>
              </div>
            </div>
          </div>
        </div>
      </nav>
  )
}
