import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { roleHome } from "@/server/policies/permissions";

export default async function Home() {
  const user = await getSession();
  redirect(user ? roleHome(user.role) : "/login");
}
