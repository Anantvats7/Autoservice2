import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleLayout from "@/components/layout/RoleLayout";
import Login from "./pages/Login";
import LandingPage from "./pages/LandingPage";

import ManagerDashboard from "./pages/manager/Dashboard";
import ManagerBookings from "./pages/manager/Bookings";
import ManagerServices from "./pages/manager/Services";
import ManagerInventory from "./pages/manager/Inventory";
import ManagerEmployees from "./pages/manager/Employees";
import ManagerCustomers from "./pages/manager/Customers";
import ManagerReports from "./pages/manager/Reports";
import ManagerServiceHistory from "./pages/manager/ServiceHistory";

import EmployeeDashboard from "./pages/employee/Dashboard";
import EmployeeJobDetail from "./pages/employee/JobDetail";
import EmployeeServiceQueue from "./pages/employee/ServiceQueue";
import EmployeeInventoryCheck from "./pages/employee/InventoryCheck";
import EmployeePerformance from "./pages/employee/Performance";

import CustomerDashboard from "./pages/customer/Dashboard";
import CustomerVehicles from "./pages/customer/MyVehicles";
import CustomerBookService from "./pages/customer/BookService";
import CustomerBookings from "./pages/customer/MyBookings";
import CustomerServiceHistory from "./pages/customer/ServiceHistory";
import CustomerDiagnostics from "./pages/customer/AIDiagnostics";
import CustomerValuation from "./pages/customer/Valuation";
import CustomerAIAssistant from "./pages/customer/AIAssistant";

import NotFound from "./pages/NotFound";
import ScanHandoff from "./pages/staff/ScanHandoff";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-right" />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />

            {/* Manager Routes */}
            <Route element={<ProtectedRoute allowedRoles={["manager"]}><RoleLayout role="manager" /></ProtectedRoute>}>
              <Route path="/manager/dashboard" element={<ManagerDashboard />} />
              <Route path="/manager/bookings" element={<ManagerBookings />} />
              <Route path="/manager/history" element={<ManagerServiceHistory />} />
              <Route path="/manager/services" element={<ManagerServices />} />
              <Route path="/manager/inventory" element={<ManagerInventory />} />
              <Route path="/manager/employees" element={<ManagerEmployees />} />
              <Route path="/manager/customers" element={<ManagerCustomers />} />
              <Route path="/manager/reports" element={<ManagerReports />} />
              <Route path="/manager/scan" element={<ScanHandoff />} />
            </Route>

            {/* Employee Routes */}
            <Route element={<ProtectedRoute allowedRoles={["employee"]}><RoleLayout role="employee" /></ProtectedRoute>}>
              <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
              <Route path="/employee/queue" element={<EmployeeServiceQueue />} />
              <Route path="/employee/inventory" element={<EmployeeInventoryCheck />} />
              <Route path="/employee/performance" element={<EmployeePerformance />} />
              <Route path="/employee/job/:id" element={<EmployeeJobDetail />} />
              <Route path="/employee/scan" element={<ScanHandoff />} />
            </Route>

            {/* Customer Routes */}
            <Route element={<ProtectedRoute allowedRoles={["customer"]}><RoleLayout role="customer" /></ProtectedRoute>}>
              <Route path="/customer/dashboard" element={<CustomerDashboard />} />
              <Route path="/customer/vehicles" element={<CustomerVehicles />} />
              <Route path="/customer/book" element={<CustomerBookService />} />
              <Route path="/customer/bookings" element={<CustomerBookings />} />
              <Route path="/customer/history" element={<CustomerServiceHistory />} />
              <Route path="/customer/diagnostics" element={<CustomerDiagnostics />} />
              <Route path="/customer/valuation" element={<CustomerValuation />} />
              <Route path="/customer/assistant" element={<CustomerAIAssistant />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
