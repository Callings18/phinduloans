import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AdminSidebar from "./AdminSidebar";
import PhinduAI from "../common/PhinduAI";
import AdminRealTimeNotifications from "./AdminRealTimeNotifications";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { user, isLoading, isStaff } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        navigate('/auth');
      } else if (!isStaff) {
        navigate('/dashboard');
      }
    }
  }, [user, isLoading, isStaff, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !isStaff) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <main className="ml-20 lg:ml-64 min-h-screen transition-all duration-300">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
      <PhinduAI />
      <AdminRealTimeNotifications />
    </div>
  );
};

export default AdminLayout;
