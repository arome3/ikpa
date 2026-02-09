import { redirect } from 'next/navigation';

// Landing page is hosted separately — redirect to sign-in
export default function Home() {
  redirect('/signin');
}
