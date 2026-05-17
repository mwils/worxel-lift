import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Loader, Center } from "@mantine/core";
import { useAuth } from "./lib/auth";

// Code-split route trees so login + verify don't ship Stripe Elements
// or Mantine form / form-heavy onboarding code. Each `.then` selects the
// named export — keeping it explicit since none of these are default exports.
const LoginRoute = lazy(() => import("./routes/login").then((m) => ({ default: m.LoginRoute })));
const VerifyRoute = lazy(() => import("./routes/verify").then((m) => ({ default: m.VerifyRoute })));
const AppLayout = lazy(() => import("./routes/app/_layout").then((m) => ({ default: m.AppLayout })));
const BoardRoute = lazy(() => import("./routes/app/board").then((m) => ({ default: m.BoardRoute })));
const NewRoRoute = lazy(() => import("./routes/app/ro/new").then((m) => ({ default: m.NewRoRoute })));
const RoDetailRoute = lazy(() =>
  import("./routes/app/ro/detail").then((m) => ({ default: m.RoDetailRoute }))
);
const CustomersRoute = lazy(() =>
  import("./routes/app/customers").then((m) => ({ default: m.CustomersRoute }))
);
const CustomerDetailRoute = lazy(() =>
  import("./routes/app/customers/detail").then((m) => ({ default: m.CustomerDetailRoute }))
);
const MessagesInboxRoute = lazy(() =>
  import("./routes/app/messages").then((m) => ({ default: m.MessagesInboxRoute }))
);
const ConversationRoute = lazy(() =>
  import("./routes/app/messages/conversation").then((m) => ({ default: m.ConversationRoute }))
);
const SettingsRoute = lazy(() =>
  import("./routes/app/settings").then((m) => ({ default: m.SettingsRoute }))
);
const OnboardingRoute = lazy(() =>
  import("./routes/onboarding").then((m) => ({ default: m.OnboardingRoute }))
);
const PublicEstimateRoute = lazy(() =>
  import("./routes/public/estimate").then((m) => ({ default: m.PublicEstimateRoute }))
);
const PublicPayRoute = lazy(() =>
  import("./routes/public/pay").then((m) => ({ default: m.PublicPayRoute }))
);

function RouteFallback() {
  return (
    <Center h="100vh">
      <Loader />
    </Center>
  );
}

export function App() {
  const { me, loading } = useAuth();

  if (loading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Public (no auth) */}
        <Route path="/public/estimate/:token" element={<PublicEstimateRoute />} />
        <Route path="/public/pay/:token" element={<PublicPayRoute />} />

        {/* Auth flow */}
        <Route path="/login" element={me ? <Navigate to="/" replace /> : <LoginRoute />} />
        <Route path="/verify" element={<VerifyRoute />} />

        {/* Onboarding (logged in, no shop yet) */}
        <Route
          path="/onboarding/*"
          element={
            !me ? (
              <Navigate to="/login" replace />
            ) : me.shop ? (
              <Navigate to="/" replace />
            ) : (
              <OnboardingRoute />
            )
          }
        />

        {/* App (logged in + onboarded) */}
        <Route
          path="/*"
          element={
            !me ? (
              <Navigate to="/login" replace />
            ) : !me.shop ? (
              <Navigate to="/onboarding" replace />
            ) : (
              <AppLayout />
            )
          }
        >
          <Route index element={<BoardRoute />} />
          <Route path="ro/new" element={<NewRoRoute />} />
          <Route path="ro/:id" element={<RoDetailRoute />} />
          <Route path="customers" element={<CustomersRoute />} />
          <Route path="customers/:id" element={<CustomerDetailRoute />} />
          <Route path="messages" element={<MessagesInboxRoute />} />
          <Route path="messages/:customerId" element={<ConversationRoute />} />
          <Route path="settings" element={<SettingsRoute />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
