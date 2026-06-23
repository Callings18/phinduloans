import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@phinduloans/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@phinduloans/shared/components/ui/card";
import { Smartphone } from "lucide-react";
import { useAuth } from "@phinduloans/shared/hooks/useAuth";

export default function BorrowerDashboardGate() {
  const { user, isLoading, isStaff } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user && isStaff) navigate("/admin", { replace: true });
  }, [user, isLoading, isStaff, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Smartphone className="w-8 h-8 text-primary" />
          </div>
          <CardTitle>Borrower portal is on mobile</CardTitle>
          <CardDescription>
            Download the Phindu Loans app to apply, view loans, and make payments.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild variant="hero" className="w-full"><Link to="/install">Download the app</Link></Button>
          <Button asChild variant="outline" className="w-full"><Link to="/">Back to home</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}
