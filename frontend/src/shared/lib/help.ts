/**
 * Handles the request for help by opening the default email client
 * with the support email address pre-filled.
 */
export const handleGetHelp = () => {
    window.location.href = "mailto:admin@bugboard.com";
};
