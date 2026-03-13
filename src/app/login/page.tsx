"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "@/app/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full justify-center rounded-md border border-transparent bg-[#1D9E75] py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-[#0F6E56] focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:ring-offset-2 disabled:opacity-50"
    >
      {pending ? "Signing in..." : "Sign in"}
    </button>
  );
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message");
  const errorParam = searchParams.get("error");
  
  const [state, action] = useFormState(async (prevState: any, formData: FormData) => {
    try {
      return await signIn(formData);
    } catch (error: any) {
      if (error.message === "NEXT_REDIRECT") {
        throw error;
      }
      return { error: error.message || "Something went wrong" };
    }
  }, null);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          {/* Medical Cross Icon placeholder */}
          <div className="bg-[#E1F5EE] p-3 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-cross">
              <path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z" />
            </svg>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-semibold text-gray-900">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Clinic Management System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm border border-gray-100 rounded-xl sm:px-10">
          
          {message === "check_your_email" && (
            <div className="mb-4 rounded-md bg-[#E1F5EE] p-4 border border-[#1D9E75]/30">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-[#059669]">Success</h3>
                  <div className="mt-2 text-sm text-[#059669]">
                    <p>Account created! Please check your email to confirm your account.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {errorParam && (
            <div className="mb-4 rounded-md bg-red-50 p-4 border border-red-200">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-[#DC2626]">
                    <p>{errorParam}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

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
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-xs uppercase tracking-wide text-gray-500">
                  Password
                </label>
                <div className="text-sm">
                  <a href="#" className="font-medium text-[#1D9E75] hover:text-[#0F6E56]">
                    Forgot your password?
                  </a>
                </div>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
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
                  New to the platform?
                </span>
              </div>
            </div>

            <div className="mt-6">
              <Link
                href="/register"
                className="flex w-full justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:ring-offset-2"
              >
                Create an account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
