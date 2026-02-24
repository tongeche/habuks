/**
 * useNewsletter Hook
 * A reusable hook for newsletter subscription forms
 */

import { useState, useCallback } from "react";
import { subscribeToNewsletter } from "../lib/newsletterService.js";

/**
 * Hook for managing newsletter subscription state
 * @param {string} source - Identifier for where the form is used (e.g., 'blog', 'landing')
 * @returns {object} Newsletter form state and handlers
 */
export function useNewsletter(source = "website") {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [message, setMessage] = useState("");

  const subscribe = useCallback(
    async (e) => {
      if (e) {
        e.preventDefault();
      }

      if (!email.trim()) {
        setStatus("error");
        setMessage("Please enter your email address");
        return;
      }

      setStatus("loading");
      setMessage("");

      const result = await subscribeToNewsletter(email, source);

      if (result.success) {
        setStatus("success");
        if (result.alreadySubscribed) {
          setMessage("You're already subscribed! Thanks for being a subscriber.");
        } else {
          setMessage("Thanks for subscribing! We'll keep you updated.");
        }
        setEmail("");
      } else {
        setStatus("error");
        setMessage(result.error || "Something went wrong. Please try again.");
      }
    },
    [email, source]
  );

  const reset = useCallback(() => {
    setEmail("");
    setStatus("idle");
    setMessage("");
  }, []);

  return {
    email,
    setEmail,
    status,
    message,
    subscribe,
    reset,
    isLoading: status === "loading",
    isSuccess: status === "success",
    isError: status === "error",
  };
}

export default useNewsletter;
