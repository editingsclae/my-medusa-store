import { redirect } from 'next/navigation';

// Settings has two pages: Delivery and Appearance. Delivery comes first.
export default function SettingsIndexPage() {
  redirect('/settings/delivery');
}
