import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { LoginStage } from "@/components/auth/login-stage";
import { getSession } from "@/lib/auth/session";
import { roleHome } from "@/server/policies/permissions";

export default async function LoginPage() {
  const user = await getSession();
  if (user) redirect(roleHome(user.role));

  return (
    <LoginStage>
      <LoginForm />
    </LoginStage>
  );
}
