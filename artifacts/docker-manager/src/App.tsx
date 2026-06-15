import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import Overview from "@/pages/overview";
import Ollama from "@/pages/ollama";
import Containers from "@/pages/containers";
import Images from "@/pages/images";
import Volumes from "@/pages/volumes";
import Install from "@/pages/install";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Overview} />
        <Route path="/ollama" component={Ollama} />
        <Route path="/containers" component={Containers} />
        <Route path="/images" component={Images} />
        <Route path="/volumes" component={Volumes} />
        <Route path="/install" component={Install} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
