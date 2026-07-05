/**
 * Donor registration page — wraps the existing DonorForm component.
 *
 * URL: /donate/register
 * After successful registration, shows the donor ID and links to dashboard.
 */
import DonorForm from "@/components/DonorForm";

export default function RegisterPage() {
  return <DonorForm />;
}
