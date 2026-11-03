import { redirect } from 'next/navigation';

// Settings has three pages: Delivery, Appearance and Footer. Delivery comes first.
export default function SettingsIndexPage() {
  redirect('/settings/delivery');
}
