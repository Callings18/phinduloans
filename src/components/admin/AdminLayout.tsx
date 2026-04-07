// AdminLayout — Auth guard is handled by AdminRoute, so no redundant check here
import AdminSidebar from "./AdminSidebar";
import AdminRealTimeNotifications from "./AdminRealTimeNotifications";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <main className="ml-20 lg:ml-64 min-h-screen transition-all duration-300">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
      <AdminRealTimeNotifications />
    </div>
  );
};

export default AdminLayout;
