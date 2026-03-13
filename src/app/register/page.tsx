"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { signUp } from "@/app/actions/auth";

// Note: Using standard HTML elements with Tailwind classes matching the Master Context design system,
// since some shadcn components might not be installed yet.

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full justify-center rounded-md border border-transparent bg-[#1D9E75] py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-[#0F6E56] focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:ring-offset-2 disabled:opacity-50"
    >
      {pending ? "Registering..." : "Register"}
    </button>
  );
}

export default function RegisterPage() {
  const [state, action] = useFormState(async (prevState: any, formData: FormData) => {
    return await signUp(formData);
  }, null);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-semibold text-gray-900">
          Create an Account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Join the Clinic Management System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm border border-gray-100 rounded-xl sm:px-10">
          
          {state?.error && (
            <div className="mb-4 rounded-md bg-red-50 p-4 border border-red-200">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-[#DC2626]">
                    <p>{state.error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <form action={action} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                  First Name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  className="block w-full appearance-none rounded-md border border-gray-200 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-[#1D9E75] focus:outline-none focus:ring-[#1D9E75] sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                  Last Name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  className="block w-full appearance-none rounded-md border border-gray-200 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-[#1D9E75] focus:outline-none focus:ring-[#1D9E75] sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="block w-full appearance-none rounded-md border border-gray-200 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-[#1D9E75] focus:outline-none focus:ring-[#1D9E75] sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                Phone Number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                className="block w-full appearance-none rounded-md border border-gray-200 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-[#1D9E75] focus:outline-none focus:ring-[#1D9E75] sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="role" className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                Role
              </label>
              <select
                id="role"
                name="role"
                required
                className="block w-full rounded-md border border-gray-200 px-3 py-2 shadow-sm focus:border-[#1D9E75] focus:outline-none focus:ring-[#1D9E75] sm:text-sm bg-white"
                defaultValue="patient"
              >
                <option value="patient">Patient</option>
                <option value="doctor">Doctor</option>
                <option value="receptionist">Receptionist</option>
              </select>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="block w-full appearance-none rounded-md border border-gray-200 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-[#1D9E75] focus:outline-none focus:ring-[#1D9E75] sm:text-sm"
              />
            </div>

            <div>
              <SubmitButton />
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-gray-500">
                  Already have an account?
                </span>
              </div>
            </div>

            <div className="mt-6">
              <Link
                href="/login"
                className="flex w-full justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:ring-offset-2"
              >
                Sign in instead
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
